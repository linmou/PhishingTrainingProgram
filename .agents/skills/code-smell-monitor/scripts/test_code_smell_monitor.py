"""Safe local regression tests; no live package installs or network calls."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('code_smell_monitor.py')
spec = importlib.util.spec_from_file_location('code_smell_monitor', SCRIPT)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorSecurityRegression(unittest.TestCase):
    def test_timeout_bytes_always_become_text_and_are_written(self):
        exc = subprocess.TimeoutExpired(['tool'], 1, output=b'partial\xff', stderr=b'problem\xfe')
        with patch.object(monitor.subprocess, 'run', side_effect=exc):
            with tempfile.TemporaryDirectory() as root:
                result = monitor.run_command(['tool'], Path(root), timeout=1)
                self.assertEqual(result['exit_code'], 124)
                self.assertIn('partial', result['stdout'])
                self.assertIsInstance(result['stdout'], str)
                self.assertIn('Timed out after', result['stderr'])
                monitor.write_raw(Path(root), 'timeout', result)
                self.assertIn('partial', (Path(root) / 'timeout.stdout.txt').read_text())

    def test_untrusted_repo_does_not_execute_package_scripts_or_local_bin(self):
        with tempfile.TemporaryDirectory() as root:
            repo = Path(root) / 'checkout'
            repo.mkdir()
            marker = repo / 'executed.marker'
            (repo / 'App.tsx').write_text('export const value: number = 2;\n')
            script = f'node -e "require(\'fs\').writeFileSync(\'{marker}\', \'unsafe\')"'
            (repo / 'package.json').write_text(json.dumps({'scripts': {'lint': script}}))
            local_bin = repo / 'node_modules' / '.bin'
            local_bin.mkdir(parents=True)
            local_tool = local_bin / 'eslint'
            local_tool.write_text('#!/bin/sh\ntouch "' + str(marker) + '"\n')
            local_tool.chmod(0o755)
            result = subprocess.run([sys.executable, str(SCRIPT), '--repo', str(repo),
                                      '--scope', 'App.tsx', '--install', 'never',
                                      '--out', str(repo / 'report')],
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(marker.exists(), 'Must not run contributor-controlled scripts or bins')
            summary = json.loads((repo / 'report' / 'summary.json').read_text())
            self.assertFalse(summary['project_execution_enabled'])
            self.assertFalse(summary['coverage_complete'])
            self.assertIn('package_lint', {r['name'] for r in summary['results']})
            for r in summary['results']:
                if r['name'] != 'gitleaks':
                    self.assertEqual(r['exit_code'], 126, r['name'])

    def test_fake_repo_local_gitleaks_in_path_is_not_executed(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            bin_dir = repo / 'bin'
            bin_dir.mkdir()
            fake = bin_dir / 'gitleaks'
            fake.write_text('#!/bin/sh\ntouch "' + str(repo / 'compromised') + '"\n')
            fake.chmod(0o755)
            with patch.dict(monitor.os.environ, {'PATH': str(bin_dir) + ':' + monitor.os.environ.get('PATH','')}):
                with patch.object(monitor.shutil, 'which', return_value=str(fake)):
                    result=monitor.run_secret_check(repo, repo / 'raw')
            self.assertEqual(result['exit_code'], 127)
            self.assertFalse((repo / 'compromised').exists())


if __name__ == '__main__':
    unittest.main()
