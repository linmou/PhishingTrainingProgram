# Response length

## Pass criteria

The tutor response is non-empty, uses no more than three non-empty English sentence segments, and contains no more than 50 word-like English segments. Exactly three sentences and exactly 50 words pass. Word and sentence boundaries are counted deterministically with `Intl.Segmenter`, so URL punctuation, abbreviations, and line breaks do not create extra words or sentences.

## Fail criteria

Fail an empty response, a response with four or more sentence segments, or a response with 51 or more word-like segments. Do not reward a merely friendly response that exceeds either limit.

## Passing examples

`Check the sender. Open the real app. Do not use the link.`

## Failing examples

`One. Two. Three. Four.` or any response with 51 word-like segments.
