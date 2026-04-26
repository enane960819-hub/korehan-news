import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/supabase_service.dart';
import '../../models/article.dart';
import '../../theme/kh_theme.dart';

class ArticleDetailScreen extends StatefulWidget {
  final String articleId;

  const ArticleDetailScreen({super.key, required this.articleId});

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  Article? _article;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await SupabaseService.client
        .from('articles')
        .select('*')
        .eq('id', int.tryParse(widget.articleId) ?? widget.articleId)
        .maybeSingle();

    if (res != null) {
      setState(() {
        _article = Article.fromJson(res);
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_article == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Article not found')),
      );
    }

    final a = _article!;
    final bodyText = (a.full ?? a.body ?? '')
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .trim();

    return Scaffold(
      appBar: AppBar(
        title: Text(a.section ?? 'News'),
        actions: [
          IconButton(icon: const Icon(Icons.bookmark_border), onPressed: () {}),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Level badge
            if (a.level != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: KhColors.bright.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(a.level!,
                    style: const TextStyle(
                        fontSize: 12,
                        color: KhColors.bright,
                        fontWeight: FontWeight.w700)),
              ),
            // Title
            Text(
              a.title,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: KhColors.text,
                height: 1.4,
              ),
            ),
            if (a.titleEn != null) ...[
              const SizedBox(height: 6),
              Text(a.titleEn!,
                  style: const TextStyle(
                      fontSize: 15, color: KhColors.gray, height: 1.4)),
            ],
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),
            // Body
            Text(
              bodyText,
              style: const TextStyle(
                fontSize: 17,
                height: 2.0,
                color: KhColors.text,
              ),
            ),
            const SizedBox(height: 40),
            // Study button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () {
                  final uri = Uri(
                    path: '/article-review',
                    queryParameters: {
                      'articleId': widget.articleId,
                      'title': a.title,
                      'body': bodyText,
                    },
                  );
                  context.go(uri.toString());
                },
                icon: const Icon(Icons.menu_book),
                label: const Text('Study this article'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
