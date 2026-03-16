export async function logReadEvent(sb, payload) {
  const { error } = await sb.rpc('log_read_event', {
    p_content_type: payload.contentType,
    p_content_id: payload.contentId,
    p_title: payload.title ?? null,
    p_category: payload.category ?? null,
    p_level: payload.level ?? null,
    p_completed: payload.completed ?? false,
    p_review_ready: payload.reviewReady ?? false,
    p_read_time_seconds: payload.readTimeSeconds ?? 0,
    p_last_position: payload.lastPosition ?? 0,
    p_source_date: payload.sourceDate ?? null
  });
  if (error) throw error;
}

export async function saveWord(sb, payload) {
  const { error } = await sb.rpc('save_or_update_word', {
    p_word_key: payload.wordKey,
    p_word_ko: payload.wordKo,
    p_word_rom: payload.wordRom ?? null,
    p_word_en: payload.wordEn ?? null,
    p_source_kind: payload.sourceKind ?? 'manual',
    p_source_content_type: payload.sourceContentType ?? null,
    p_source_content_id: payload.sourceContentId ?? null,
    p_interest_tag: payload.interestTag ?? null,
    p_review_delta: payload.reviewDelta ?? 0,
    p_correct_delta: payload.correctDelta ?? 0,
    p_wrong_delta: payload.wrongDelta ?? 0
  });
  if (error) throw error;
}

export async function logQuizResult(sb, payload) {
  const { error } = await sb.rpc('log_quiz_result', {
    p_skill_type: payload.skillType,
    p_quiz_type: payload.quizType,
    p_item_id: payload.itemId ?? null,
    p_content_type: payload.contentType ?? null,
    p_content_id: payload.contentId ?? null,
    p_grammar_point: payload.grammarPoint ?? null,
    p_prompt: payload.prompt ?? null,
    p_user_answer: payload.userAnswer ?? null,
    p_correct_answer: payload.correctAnswer ?? null,
    p_is_correct: payload.isCorrect ?? false,
    p_score: payload.score ?? null
  });
  if (error) throw error;
}

export async function getLearningHubSnapshot(sb, days = 7) {
  const { data, error } = await sb.rpc('get_learning_hub_snapshot', { p_days: days });
  if (error) throw error;
  return data;
}

export async function assignDailyVocab(sb, assignmentDate = null) {
  const { data, error } = await sb.rpc('assign_daily_vocab', {
    p_assignment_date: assignmentDate
  });
  if (error) throw error;
  return data;
}

export async function onArticleOpened(sb, article) {
  await logReadEvent(sb, {
    contentType: 'article',
    contentId: String(article.id ?? article.slug),
    title: article.title,
    category: article.category ?? null,
    level: article.level ?? null,
    completed: false,
    reviewReady: false,
    readTimeSeconds: 0,
    lastPosition: 0
  });
}

export async function onArticleCompleted(sb, article, secondsSpent) {
  await logReadEvent(sb, {
    contentType: 'article',
    contentId: String(article.id ?? article.slug),
    title: article.title,
    category: article.category ?? null,
    level: article.level ?? null,
    completed: true,
    reviewReady: true,
    readTimeSeconds: secondsSpent ?? 0,
    lastPosition: 100
  });
}

export async function onWordSavedFromHover(sb, word, context = {}) {
  await saveWord(sb, {
    wordKey: word.id ?? word.word_ko,
    wordKo: word.word_ko,
    wordRom: word.romanization ?? null,
    wordEn: word.meaning_en ?? null,
    sourceKind: context.sourceKind ?? 'article',
    sourceContentType: context.contentType ?? 'article',
    sourceContentId: context.contentId ?? null
  });
}

export async function onGrammarQuizAnswered(sb, quiz, isCorrect, userAnswer) {
  await logQuizResult(sb, {
    skillType: 'grammar',
    quizType: 'grammar_multiple_choice',
    itemId: String(quiz.id),
    contentType: quiz.contentType ?? 'article',
    contentId: quiz.contentId ?? null,
    grammarPoint: quiz.grammarPoint,
    prompt: quiz.prompt ?? null,
    userAnswer,
    correctAnswer: quiz.correctAnswer ?? null,
    isCorrect,
    score: isCorrect ? 100 : 0
  });
}

export async function onVocabReviewAnswered(sb, card, isCorrect) {
  await saveWord(sb, {
    wordKey: card.wordKey,
    wordKo: card.wordKo,
    wordRom: card.wordRom ?? null,
    wordEn: card.wordEn ?? null,
    reviewDelta: 1,
    correctDelta: isCorrect ? 1 : 0,
    wrongDelta: isCorrect ? 0 : 1
  });

  await logQuizResult(sb, {
    skillType: 'vocab',
    quizType: 'vocab_flashcard',
    itemId: String(card.wordKey),
    isCorrect,
    score: isCorrect ? 100 : 0
  });
}
