class Article {
  final String id;
  final String title;
  final String? titleEn;
  final String? body;
  final String? full;
  final String? section;
  final String? level;
  final String? status;
  final DateTime? createdAt;
  final DateTime? publishedAt;

  Article({
    required this.id,
    required this.title,
    this.titleEn,
    this.body,
    this.full,
    this.section,
    this.level,
    this.status,
    this.createdAt,
    this.publishedAt,
  });

  factory Article.fromJson(Map<String, dynamic> json) {
    return Article(
      id: json['id'].toString(),
      title: json['title'] ?? '',
      titleEn: json['title_en'],
      body: json['body'],
      full: json['full'],
      section: json['section'],
      level: json['level'],
      status: json['status'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      publishedAt: json['published_at'] != null
          ? DateTime.parse(json['published_at'])
          : null,
    );
  }
}
