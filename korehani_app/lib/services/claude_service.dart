import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/supabase_config.dart';
import 'supabase_service.dart';

class ClaudeService {
  static Future<Map<String, dynamic>?> call({
    required String feature,
    String model = 'claude-haiku-4-5-20251001',
    int maxTokens = 2000,
    required List<Map<String, String>> messages,
  }) async {
    final token = SupabaseService.accessToken;
    if (token == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse(SupabaseConfig.claudeProxyUrl),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'feature': feature,
        'model': model,
        'max_tokens': maxTokens,
        'messages': messages,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else if (response.statusCode == 429) {
      throw Exception('Rate limited — please wait');
    } else {
      throw Exception('Claude API error: ${response.statusCode}');
    }
  }
}
