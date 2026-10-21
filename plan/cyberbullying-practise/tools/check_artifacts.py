#!/usr/bin/env python3
# Purpose: validate this planning run's artifact contracts and compute judge aggregation without modifying files.
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check_markdown(folder, names, headings):
    directory = ROOT / folder
    actual = sorted(path.name for path in directory.glob('*.md'))
    assert actual == sorted(names), (folder, actual)
    texts = []
    for name in names:
        content = (directory / name).read_text()
        assert content.strip(), name
        for heading in headings:
            assert len(re.findall(r'^#{1,2} ' + re.escape(heading) + r'\s*$', content, re.M)) == 1, (name, heading)
        assert not re.search(r'<planName>|replace-me|\[fill|\bTODO\b|\bTBD\b', content), name
        texts.append(content)
    return texts


def main():
    stage = sys.argv[1]
    if stage == 'candidates':
        names = [f'plan_{number}.md' for number in range(1, 5)]
        check_markdown('candidates', names, ['Assigned Approach', 'Assumptions', 'Major Decisions', 'Ordered Implementation Steps', 'Risks and Mitigations', 'Validation Criteria'])
        print(json.dumps({'gate': 'pass', 'files': names}))
    elif stage == 'judges':
        names = [f'judge_{number:02}.md' for number in range(1, 6)]
        texts = check_markdown('judgements_1st', names, ['Full Ranking', 'Rubric Scores', 'Ranking Reasons', 'Risks and Tradeoffs', 'Recommended Backbone', 'Reusable Contributions', 'Incompatibilities'])
        sums = {number: {'rank_sum': 0, 'score_sum': 0, 'first_votes': 0} for number in range(1, 5)}
        results = []
        for name, text in zip(names, texts):
            ranking_text = text.split('## Full Ranking')[1].split('\n## ')[0]
            ranking = [int(value) for value in re.findall(r'^\d\.\s+`?plan_([1-4])\.md`?', ranking_text, re.M)]
            assert sorted(ranking) == [1, 2, 3, 4], (name, ranking)
            score_text = text.split('## Rubric Scores')[1].split('\n## ')[0]
            rows = re.findall(r'^\|\s*`?plan_([1-4])\.md`?\s*\|\s*([1-5])\s*\|\s*([1-5])\s*\|\s*([1-5])\s*\|\s*([1-5])\s*\|\s*([1-5])\s*\|\s*([1-5])\s*\|\s*(\d+)\s*\|\s*$', score_text, re.M)
            assert sorted(int(row[0]) for row in rows) == [1, 2, 3, 4], (name, rows)
            totals = {}
            for row in rows:
                number, *values = map(int, row)
                assert sum(values[:6]) == values[6], (name, row)
                totals[number] = values[6]
                sums[number]['score_sum'] += values[6]
            for position, number in enumerate(ranking, 1):
                sums[number]['rank_sum'] += position
                sums[number]['first_votes'] += position == 1
            results.append({'judge': name, 'ranking': ranking, 'totals': totals})
        backbone = min(sums, key=lambda number: (sums[number]['rank_sum'], -sums[number]['score_sum'], -sums[number]['first_votes'], number))
        print(json.dumps({'gate': 'pass', 'judges': results, 'aggregate': sums, 'backbone': backbone}, indent=2))
    elif stage == 'publication':
        paths = [ROOT / name for name in ['draft_final_plan.md', 'final_plan.md']]
        hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
        assert len(set(hashes.values())) == 1, hashes
        print(json.dumps({'gate': 'pass', 'sha256': hashes}, indent=2))
    else:
        raise ValueError(stage)


if __name__ == '__main__':
    main()
