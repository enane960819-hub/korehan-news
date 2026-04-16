import 'supabase_service.dart';

class LearningHubService {
  static final _client = SupabaseService.client;

  static Future<void> logReadEvent({
    required String contentType,
    required String contentId,
    String? title,
    String? category,
    String? level,
    bool completed = false,
    bool reviewReady = false,
    int readTimeSeconds = 0,
    String? lastPosition,
    String? sourceDate,
  }) async {
    await _client.rpc('log_read_event', params: {
      'p_content_type': contentType,
      'p_content_id': contentId,
      'p_title': title,
      'p_category': category,
      'p_level': level,
      'p_completed': completed,
      'p_review_ready': reviewReady,
      'p_read_time_seconds': readTimeSeconds,
      'p_last_position': lastPosition,
      'p_source_date': sourceDate,
    });
  }

  static Future<void> saveWord({
    required String wordKey,
    required String wordKo,
    String? wordRom,
    String? wordEn,
    String sourceKind = 'hover',
    String? sourceContentType,
    String? sourceContentId,
    String? interestTag,
    int reviewDelta = 0,
    int correctDelta = 0,
    int wrongDelta = 0,
  }) async {
    await _client.rpc('save_or_update_word', params: {
      'p_word_key': wordKey,
      'p_word_ko': wordKo,
      'p_word_rom': wordRom,
      'p_word_en': wordEn,
      'p_source_kind': sourceKind,
      'p_source_content_type': sourceContentType,
      'p_source_content_id': sourceContentId,
      'p_interest_tag': interestTag,
      'p_review_delta': reviewDelta,
      'p_correct_delta': correctDelta,
      'p_wrong_delta': wrongDelta,
    });
  }

  static Future<void> logQuizResult({
    required String skillType,
    required String quizType,
    String? itemId,
    String? contentType,
    String? contentId,
    String? grammarPoint,
    String? prompt,
    String? userAnswer,
    String? correctAnswer,
    required bool isCorrect,
    int score = 0,
  }) async {
    await _client.rpc('log_quiz_result', params: {
      'p_skill_type': skillType,
      'p_quiz_type': quizType,
      'p_item_id': itemId,
      'p_content_type': contentType,
      'p_content_id': contentId,
      'p_grammar_point': grammarPoint,
      'p_prompt': prompt,
      'p_user_answer': userAnswer,
      'p_correct_answer': correctAnswer,
      'p_is_correct': isCorrect,
      'p_score': score,
    });
  }

  static Future<Map<String, dynamic>?> getSnapshot({int days = 7}) async {
    final result = await _client.rpc('get_learning_hub_snapshot', params: {
      'p_days': days,
    });
    return result;
  }

  static Future<dynamic> assignDailyVocab({String? date}) async {
    final result = await _client.rpc('assign_daily_vocab', params: {
      if (date != null) 'p_assignment_date': date,
    });
    return result;
  }
}
