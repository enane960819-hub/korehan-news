import 'package:flutter/material.dart';
import '../../services/supabase_service.dart';
import '../../models/story.dart';
import '../../theme/kh_theme.dart';

class StoriesScreen extends StatefulWidget {
  const StoriesScreen({super.key});

  @override
  State<StoriesScreen> createState() => _StoriesScreenState();
}

class _StoriesScreenState extends State<StoriesScreen> {
  List<Story> _stories = [];
  bool _loading = true;
  String _selectedMood = 'All';
  final _moods = ['All', 'Fun', 'Touching', 'Scary', 'Shocking'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await SupabaseService.client
        .from('stories_data')
        .select('id, title, title_en, preview, read_time, lvl, mood')
        .order('created_at', ascending: false)
        .limit(40);

    setState(() {
      _stories = (res as List).map((e) => Story.fromJson(e)).toList();
      _loading = false;
    });
  }

  List<Story> get _filtered {
    if (_selectedMood == 'All') return _stories;
    return _stories.where((s) =>
        (s.mood ?? '').toLowerCase() == _selectedMood.toLowerCase()).toList();
  }

  String _moodEmoji(String? mood) => switch (mood?.toLowerCase()) {
    'fun' => '😄', 'touching' => '🥹', 'scary' => '😱',
    'shocking' => '😮', _ => '📖',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Stories')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _moods.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final active = _moods[i] == _selectedMood;
                return GestureDetector(
                  onTap: () => setState(() => _selectedMood = _moods[i]),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KhColors.bright : KhColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? KhColors.bright : KhColors.border),
                    ),
                    child: Text(_moods[i],
                        style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600,
                          color: active ? Colors.white : KhColors.gray,
                        )),
                  ),
                );
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final s = _filtered[i];
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: KhColors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: KhColors.border),
                        ),
                        child: Row(
                          children: [
                            Text(_moodEmoji(s.mood), style: const TextStyle(fontSize: 32)),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(s.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 4),
                                  if (s.preview != null)
                                    Text(s.preview!, maxLines: 2, overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 13, color: KhColors.gray)),
                                ],
                              ),
                            ),
                            Column(
                              children: [
                                Text(s.lvl ?? '', style: const TextStyle(fontSize: 11, color: KhColors.gray)),
                                if (s.readTime != null) ...[
                                  const SizedBox(height: 4),
                                  Text('${s.readTime}m', style: const TextStyle(fontSize: 11, color: KhColors.gray)),
                                ],
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
