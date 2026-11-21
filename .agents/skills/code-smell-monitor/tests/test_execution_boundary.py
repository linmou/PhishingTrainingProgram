"""Local trust boundary must cover newly added graph and production adapters."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/code_smell_monitor.py'
spec = importlib.util.spec_from_file_location('local_monitor', SCRIPT)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

class ExecutionBoundaryTests(unittest.TestCase):
    def test_architecture_only_cannot_bypass_execution_opt_in(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'package.json').write_text('{}')
            (root / 'app.ts').write_text('export const app = 1;')
            out = root / 'report'
            with patch.object(sys, 'argv', ['monitor', '--repo', str(root),
                                           '--architecture-only', '--out', str(out)]), \
                 patch.object(monitor, 'analyze_architecture', side_effect=AssertionError('executed')), \
                 patch.object(monitor, 'run_js_checks', side_effect=AssertionError('executed')):
                self.assertEqual(monitor.main(), 0)
            summary = json.loads((out / 'summary.json').read_text())
            self.assertFalse(summary['coverage']['complete'])
            self.assertFalse(summary['project_execution_enabled'])
            self.assertEqual(summary['install_mode'], 'never')
            statuses = {item['name']: item['status'] for item in summary['results']}
            self.assertEqual(statuses['knip_production'], 'unavailable')
            self.assertEqual(statuses['behavioral_redundancy'], 'unavailable')
