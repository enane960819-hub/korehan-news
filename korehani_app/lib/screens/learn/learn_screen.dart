import 'package:flutter/material.dart';
import '../../services/supabase_service.dart';
import '../../models/saved_word.dart';
import '../../theme/kh_theme.dart';

class LearnScreen extends StatefulWidget {
  const LearnScreen({super.key});

  @override
  State<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends State<LearnScreen> {
  List<SavedWord> _dueWords = [];
  bool _loading = true;
  int _totalSaved = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    final today = DateTime.now().toIso8601String().substring(0, 10);

    final [dueRes, countRes] = await Future.wait([
      SupabaseService.client
          .from('user_saved_words')
          .select('word_ko, word_rom, word_en, srs_interval, srs_ease_factor, srs_next_review, srs_review_count, correct_count, wrong_count')
          .eq('user_id', userId)
          .lte('srs_next_review', today)
          .order('srs_next_review', ascending: true)
          .limit(50),
      SupabaseService.client
          .from('user_saved_words')
          .select('word_ko')
          .eq('user_id', userId),
    ]);

    setState(() {
      _dueWords = (dueRes as List).map((e) => SavedWord.fromJson(e)).toList();
      _totalSaved = (countRes as List).length;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Learn')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // SRS Review Banner
                if (_dueWords.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(20),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [KhColors.navy, KhColors.blue],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Words to Review',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                        const SizedBox(height: 4),
                        Text('${_dueWords.length} words due today',
                            style: TextStyle(
                                fontSize: 14,
                                color: Colors.white.withValues(alpha: 0.7))),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () {
                              // TODO: start flashcard review
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: KhColors.navy,
                            ),
                            child: const Text('Start Review'),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Stats row
                Row(
                  children: [
                    _statCard('Saved', '$_totalSaved', Icons.bookmark),
                    const SizedBox(width: 12),
                    _statCard(
                        'Due', '${_dueWords.length}', Icons.schedule),
                  ],
                ),
                const SizedBox(height: 24),

                // Sections
                _sectionTile(Icons.abc, 'Hangul Basics', 'Learn the Korean alphabet'),
                _sectionTile(Icons.style, 'Flashcards', 'Study vocabulary by category'),
                _sectionTile(Icons.quiz, 'Word Quiz', 'Test your vocabulary'),
                _sectionTile(Icons.headphones, 'Listening Quiz', 'Train your ear'),
              ],
            ),
    );
  }

  Widget _statCard(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KhColors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KhColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, color: KhColors.bright, size: 20),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w700)),
                Text(label,
                    style:
                        const TextStyle(fontSize: 12, color: KhColors.gray)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTile(IconData icon, String title, String sub) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KhColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KhColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, color: KhColors.bright),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                Text(sub,
                    style: const TextStyle(
                        fontSize: 12, color: KhColors.gray)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: KhColors.gray),
        ],
      ),
    );
  }
}
