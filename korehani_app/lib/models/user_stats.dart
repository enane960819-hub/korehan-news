class UserStats {
  final int xp;
  final int coinBalance;
  final int wordsSaved;
  final int articlesRead;
  final int quizzesDone;
  final int streak;
  final String? displayName;
  final bool onboarded;

  UserStats({
    this.xp = 0,
    this.coinBalance = 0,
    this.wordsSaved = 0,
    this.articlesRead = 0,
    this.quizzesDone = 0,
    this.streak = 0,
    this.displayName,
    this.onboarded = false,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    return UserStats(
      xp: json['xp'] ?? 0,
      coinBalance: json['coin_balance'] ?? 0,
      wordsSaved: json['words_saved'] ?? 0,
      articlesRead: json['articles_read'] ?? 0,
      quizzesDone: json['quizzes_done'] ?? 0,
      streak: json['streak'] ?? 0,
      displayName: json['display_name'],
      onboarded: json['onboarded'] ?? false,
    );
  }
}
