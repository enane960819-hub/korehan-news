class Story {
  final String id;
  final String title;
  final String? titleEn;
  final String? preview;
  final int? readTime;
  final String? lvl;
  final String? mood;
  final String? genre;
  final Map<String, dynamic>? data;

  Story({
    required this.id,
    required this.title,
    this.titleEn,
    this.preview,
    this.readTime,
    this.lvl,
    this.mood,
    this.genre,
    this.data,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    return Story(
      id: json['id'].toString(),
      title: json['title'] ?? '',
      titleEn: json['title_en'],
      preview: json['preview'],
      readTime: json['read_time'],
      lvl: json['lvl'],
      mood: json['mood'],
      genre: json['genre'],
      data: json['data'] is Map<String, dynamic> ? json['data'] : null,
    );
  }

  String? get body => data?['body'];

  List<Map<String, dynamic>> get vocab {
    if (data == null) return [];
    final v = data!['vocab'];
    if (v is List) return v.cast<Map<String, dynamic>>();
    return [];
  }
}
