import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/kh_logo.dart';
import '../../theme/kh_theme.dart';
import '../../services/supabase_service.dart';
import '../../models/article.dart';
import '../../models/conversation.dart';
import '../../models/story.dart';
import '../../widgets/article_card.dart';
import '../../widgets/section_header.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Article> _articles = [];
  List<Conversation> _conversations = [];
  List<Story> _stories = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final sb = SupabaseService.client;
    try {
      final [articlesRes, convsRes, storiesRes] = await Future.wait([
        sb
            .from('articles')
            .select('id, title, title_en, body, section, level, created_at')
            .eq('status', 'published')
            .order('created_at', ascending: false)
            .limit(10),
        sb
            .from('conversations_data')
            .select('id, name, ctx, cat, lvl')
            .order('created_at', ascending: false)
            .limit(10),
        sb
            .from('stories_data')
            .select('id, title, title_en, preview, read_time, lvl, mood')
            .order('created_at', ascending: false)
            .limit(10),
      ]);

      setState(() {
        _articles = (articlesRes as List)
            .map((e) => Article.fromJson(e))
            .toList();
        _conversations = (convsRes as List)
            .map((e) => Conversation.fromJson(e))
            .toList();
        _stories = (storiesRes as List)
            .map((e) => Story.fromJson(e))
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const KhLogo(fontSize: 28),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  // Quick Actions
                  _buildQuickActions(),
                  // News
                  SectionHeader(
                    title: 'News',
                    onSeeAll: () => context.go('/news'),
                  ),
                  _buildArticleList(),
                  // Conversations
                  SectionHeader(
                    title: 'Conversations',
                    onSeeAll: () => context.go('/conversations'),
                  ),
                  _buildConversationList(),
                  // Stories
                  SectionHeader(
                    title: 'Stories',
                    onSeeAll: () => context.go('/stories'),
                  ),
                  _buildStoryList(),
                ],
              ),
            ),
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          _actionChip(Icons.menu_book_rounded, 'Study Room', '/study'),
          const SizedBox(width: 10),
          _actionChip(Icons.school_rounded, 'Learn', '/learn'),
          const SizedBox(width: 10),
          _actionChip(Icons.insights_rounded, 'Growth Lab', '/growth-lab'),
        ],
      ),
    );
  }

  Widget _actionChip(IconData icon, String label, String route) {
    return Expanded(
      child: GestureDetector(
        onTap: () => context.go(route),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: KhColors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: KhColors.border),
          ),
          child: Column(
            children: [
              Icon(icon, color: KhColors.bright, size: 24),
              const SizedBox(height: 6),
              Text(label,
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: KhColors.text)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildArticleList() {
    if (_articles.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No articles yet'),
      );
    }
    return SizedBox(
      height: 200,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _articles.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => SizedBox(
          width: 280,
          child: ArticleCard(
            article: _articles[i],
            onTap: () => context.go('/article/${_articles[i].id}'),
          ),
        ),
      ),
    );
  }

  Widget _buildConversationList() {
    if (_conversations.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No conversations yet'),
      );
    }
    return SizedBox(
      height: 130,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _conversations.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final c = _conversations[i];
          return Container(
            width: 240,
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: KhColors.sky.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(c.cat ?? '',
                          style: const TextStyle(
                              fontSize: 11, color: KhColors.bright)),
                    ),
                    const Spacer(),
                    _levelBadge(c.lvl),
                  ],
                ),
                const SizedBox(height: 10),
                Text(c.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                if (c.ctx != null) ...[
                  const SizedBox(height: 4),
                  Text(c.ctx!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, color: KhColors.gray)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStoryList() {
    if (_stories.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No stories yet'),
      );
    }
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _stories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final s = _stories[i];
          return Container(
            width: 220,
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
                    Text(_moodEmoji(s.mood), style: const TextStyle(fontSize: 18)),
                    const SizedBox(width: 6),
                    _levelBadge(s.lvl),
                    const Spacer(),
                    if (s.readTime != null)
                      Text('${s.readTime}min',
                          style: const TextStyle(
                              fontSize: 11, color: KhColors.gray)),
                  ],
                ),
                const SizedBox(height: 10),
                Text(s.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                if (s.preview != null) ...[
                  const SizedBox(height: 4),
                  Text(s.preview!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, color: KhColors.gray)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _levelBadge(String? lvl) {
    final color = switch (lvl?.toLowerCase()) {
      'starter' || 's' => Colors.green,
      'beginner' || 'b' => Colors.blue,
      'intermediate' || 'i' => Colors.orange,
      'advanced' || 'a' => Colors.red,
      _ => KhColors.gray,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        lvl ?? '',
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700),
      ),
    );
  }

  String _moodEmoji(String? mood) {
    return switch (mood?.toLowerCase()) {
      'fun' => '😄',
      'touching' => '🥹',
      'scary' => '😱',
      'shocking' => '😮',
      'romance' => '💕',
      'adventure' => '🗺️',
      'slice-of-life' => '🌿',
      _ => '📖',
    };
  }
}
