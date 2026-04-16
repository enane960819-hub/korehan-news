class SavedWord {
  final String wordKey;
  final String wordKo;
  final String? wordRom;
  final String? wordEn;
  final int srsInterval;
  final double srsEaseFactor;
  final String? srsNextReview;
  final int srsReviewCount;
  final int correctCount;
  final int wrongCount;

  SavedWord({
    required this.wordKey,
    required this.wordKo,
    this.wordRom,
    this.wordEn,
    this.srsInterval = 1,
    this.srsEaseFactor = 2.5,
    this.srsNextReview,
    this.srsReviewCount = 0,
    this.correctCount = 0,
    this.wrongCount = 0,
  });

  factory SavedWord.fromJson(Map<String, dynamic> json) {
    return SavedWord(
      wordKey: json['word_key'] ?? json['word_ko'] ?? '',
      wordKo: json['word_ko'] ?? '',
      wordRom: json['word_rom'],
      wordEn: json['word_en'],
      srsInterval: json['srs_interval'] ?? 1,
      srsEaseFactor: (json['srs_ease_factor'] ?? 2.5).toDouble(),
      srsNextReview: json['srs_next_review'],
      srsReviewCount: json['srs_review_count'] ?? 0,
      correctCount: json['correct_count'] ?? 0,
      wrongCount: json['wrong_count'] ?? 0,
    );
  }

  bool get isDueForReview {
    if (srsNextReview == null) return true;
    final due = DateTime.parse(srsNextReview!);
    return !DateTime.now().isBefore(due);
  }
}
