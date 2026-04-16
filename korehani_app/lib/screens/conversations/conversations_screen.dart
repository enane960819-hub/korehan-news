import 'package:flutter/material.dart';
import '../../services/supabase_service.dart';
import '../../models/conversation.dart';
import '../../theme/kh_theme.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<Conversation> _convs = [];
  bool _loading = true;
  String _selectedCat = 'All';
  final _cats = ['All', 'Everyday', 'Workplace', 'Friends', 'Family', 'Dating'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await SupabaseService.client
        .from('conversations_data')
        .select('id, name, ctx, cat, lvl, data')
        .order('created_at', ascending: false)
        .limit(50);

    setState(() {
      _convs = (res as List).map((e) => Conversation.fromJson(e)).toList();
      _loading = false;
    });
  }

  List<Conversation> get _filtered {
    if (_selectedCat == 'All') return _convs;
    return _convs.where((c) =>
        (c.cat ?? '').toLowerCase() == _selectedCat.toLowerCase()).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Conversations')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _cats.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final active = _cats[i] == _selectedCat;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCat = _cats[i]),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KhColors.bright : KhColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? KhColors.bright : KhColors.border),
                    ),
                    child: Text(_cats[i],
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
                      final c = _filtered[i];
                      return _convCard(c);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _convCard(Conversation c) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KhColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: KhColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: KhColors.sky.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(c.cat ?? '', style: const TextStyle(fontSize: 11, color: KhColors.bright)),
              ),
              const Spacer(),
              Text(c.lvl ?? '', style: const TextStyle(fontSize: 11, color: KhColors.gray)),
            ],
          ),
          const SizedBox(height: 10),
          Text(c.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          if (c.ctx != null) ...[
            const SizedBox(height: 4),
            Text(c.ctx!, style: const TextStyle(fontSize: 13, color: KhColors.gray)),
          ],
        ],
      ),
    );
  }
}
