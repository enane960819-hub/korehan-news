import 'package:flutter/material.dart';
import '../../services/supabase_service.dart';
import '../../services/learning_hub_service.dart';
import '../../theme/kh_theme.dart';

class GrowthLabScreen extends StatefulWidget {
  const GrowthLabScreen({super.key});

  @override
  State<GrowthLabScreen> createState() => _GrowthLabScreenState();
}

class _GrowthLabScreenState extends State<GrowthLabScreen> {
  Map<String, dynamic>? _snapshot;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!SupabaseService.isLoggedIn) return;
    try {
      final data = await LearningHubService.getSnapshot(days: 7);
      setState(() {
        _snapshot = data;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Growth Lab')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Hero
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [KhColors.navy, KhColors.blue],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Growth Lab',
                          style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                      const SizedBox(height: 6),
                      Text('Your weekly learning analytics',
                          style: TextStyle(
                              fontSize: 14,
                              color: Colors.white.withValues(alpha: 0.7))),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Stats grid
                Row(
                  children: [
                    _stat('Reading', _val('reading_score'), Icons.auto_stories),
                    const SizedBox(width: 12),
                    _stat('Vocab', _val('vocab_score'), Icons.translate),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _stat('Grammar', _val('grammar_score'), Icons.rule),
                    const SizedBox(width: 12),
                    _stat('Streak', _val('streak'), Icons.local_fire_department),
                  ],
                ),
                const SizedBox(height: 24),
                // Daily Review
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: KhColors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: KhColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Daily Review',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      const Text('Test your knowledge from this week\'s learning',
                          style: TextStyle(fontSize: 13, color: KhColors.gray)),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {},
                          child: const Text('Start Review'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  String _val(String key) {
    if (_snapshot == null) return '—';
    final v = _snapshot![key];
    return v?.toString() ?? '—';
  }

  Widget _stat(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: KhColors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KhColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: KhColors.bright, size: 22),
            const SizedBox(height: 10),
            Text(value,
                style: const TextStyle(
                    fontSize: 28, fontWeight: FontWeight.w700)),
            Text(label,
                style:
                    const TextStyle(fontSize: 12, color: KhColors.gray)),
          ],
        ),
      ),
    );
  }
}
