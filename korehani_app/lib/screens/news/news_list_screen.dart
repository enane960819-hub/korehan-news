import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/supabase_service.dart';
import '../../models/article.dart';
import '../../widgets/article_card.dart';
import '../../theme/kh_theme.dart';

class NewsListScreen extends StatefulWidget {
  const NewsListScreen({super.key});

  @override
  State<NewsListScreen> createState() => _NewsListScreenState();
}

class _NewsListScreenState extends State<NewsListScreen> {
  List<Article> _articles = [];
  bool _loading = true;
  String _selectedSection = 'All';
  List<String> _sections = ['All'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sb = SupabaseService.client;
    var query = sb
        .from('articles')
        .select('id, title, title_en, body, section, level, created_at')
        .eq('status', 'published')
        .order('created_at', ascending: false)
        .limit(50);

    if (_selectedSection != 'All') {
      query = sb
          .from('articles')
          .select('id, title, title_en, body, section, level, created_at')
          .eq('status', 'published')
          .eq('section', _selectedSection)
          .order('created_at', ascending: false)
          .limit(50);
    }

    final res = await query;
    final articles = (res as List).map((e) => Article.fromJson(e)).toList();

    // Extract unique sections
    final secs = articles.map((a) => a.section).whereType<String>().toSet();

    setState(() {
      _articles = articles;
      _sections = ['All', ...secs];
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('News')),
      body: Column(
        children: [
          // Section filter chips
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _sections.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final active = _sections[i] == _selectedSection;
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedSection = _sections[i];
                      _loading = true;
                    });
                    _load();
                  },
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KhColors.bright : KhColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: active ? KhColors.bright : KhColors.border),
                    ),
                    child: Text(
                      _sections[i],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: active ? Colors.white : KhColors.gray,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          // Article list
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _articles.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, i) => SizedBox(
                        height: 160,
                        child: ArticleCard(
                          article: _articles[i],
                          onTap: () =>
                              context.go('/article/${_articles[i].id}'),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
