<!-- sync marker -->
# KoreHani Learning Hub integration guide

## What this gives you
- weak grammar tracking
- daily 20-word assignments
- read history / review queue
- saved words
- daily progress
- learning hub snapshot RPC

## Use 5 real score axes
- Reading
- Vocabulary
- Grammar
- Writing
- Listening

Do not score Speaking yet.
Treat it as a separate activity card until you build audio recording + STT + pronunciation scoring.

## Apply order

### 1) Run the SQL
Run `learning_hub_schema.sql` in Supabase SQL Editor.

### 2) Add frontend helper
Import `learning_hub_client.js`.

### 3) Start logging real actions
At minimum wire these moments:
- article / conversation / story open
- article / conversation / story completed
- word saved from hover
- grammar quiz answered
- vocab review answered

### 4) Build the hub page from the snapshot RPC
Call:
`get_learning_hub_snapshot(7)`

Use the result for:
- today card
- weekly graph
- weak grammar
- review queue
- saved words preview
- score radar / bars

## Suggested page mapping

### Home preview
Use:
- today.words_learned
- today.articles_read
- weak_grammar[0]
- streak

### Study Room
Use:
- weak_grammar
- review_queue
- daily vocab assignments

### My Page
Use:
- user_read_history
- user_saved_words
- user_daily_progress

### Learning Hub page
Use the full snapshot RPC.

## Daily 20 words
The SQL includes `assign_daily_vocab(date)`.

It expects a source table named:
`public.vocabulary_bank`

That table should have at least:
- word_key
- word_ko
- word_rom
- word_en
- interest_tag
- is_active

If your table name is different, replace it in the SQL function.

## Best next step
1. create `vocabulary_bank`
2. wire article read logging
3. wire grammar quiz logging
4. build one real Learning Hub page from the snapshot RPC

That is the point where the hub stops being fake UI and starts being a real product.
