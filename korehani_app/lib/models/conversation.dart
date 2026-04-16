class Conversation {
  final String id;
  final String name;
  final String? ctx;
  final String? cat;
  final String? lvl;
  final Map<String, dynamic>? data;

  Conversation({
    required this.id,
    required this.name,
    this.ctx,
    this.cat,
    this.lvl,
    this.data,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'].toString(),
      name: json['name'] ?? '',
      ctx: json['ctx'],
      cat: json['cat'],
      lvl: json['lvl'],
      data: json['data'] is Map<String, dynamic> ? json['data'] : null,
    );
  }

  List<Map<String, dynamic>> get msgs {
    if (data == null) return [];
    final m = data!['msgs'];
    if (m is List) return m.cast<Map<String, dynamic>>();
    return [];
  }

  List<Map<String, dynamic>> get vocab {
    if (data == null) return [];
    final v = data!['vocab'];
    if (v is List) return v.cast<Map<String, dynamic>>();
    return [];
  }
}
