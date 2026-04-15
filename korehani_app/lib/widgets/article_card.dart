import 'package:flutter/material.dart';
import '../models/article.dart';
import '../theme/kh_theme.dart';

class ArticleCard extends StatelessWidget {
  final Article article;
  final VoidCallback? onTap;

  const ArticleCard({super.key, required this.article, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
                if (article.section != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: KhColors.bright.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      article.section!,
                      style: const TextStyle(
                          fontSize: 11,
                          color: KhColors.bright,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(width: 8),
                if (article.level != null) _levelBadge(article.level!),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              article.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: KhColors.text,
                height: 1.4,
              ),
            ),
            const Spacer(),
            if (article.body != null)
              Text(
                _stripHtml(article.body!),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13, color: KhColors.gray, height: 1.5),
              ),
          ],
        ),
      ),
    );
  }

  Widget _levelBadge(String lvl) {
    final color = switch (lvl.toLowerCase()) {
      'starter' => Colors.green,
      'beginner' => Colors.blue,
      'intermediate' => Colors.orange,
      'advanced' => Colors.red,
      _ => KhColors.gray,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(lvl,
          style: TextStyle(
              fontSize: 10, color: color, fontWeight: FontWeight.w700)),
    );
  }

  String _stripHtml(String html) {
    return html.replaceAll(RegExp(r'<[^>]*>'), '');
  }
}
