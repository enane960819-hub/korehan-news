import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/kh_theme.dart';

class StudyRoomScreen extends StatelessWidget {
  const StudyRoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cards = [
      _StudyCardData(
        icon: Icons.edit_note,
        title: 'Daily Writing',
        subtitle: 'Practice writing on today\'s topic',
        color: KhColors.bright,
        onTap: () => context.go('/study'),
      ),
      _StudyCardData(
        icon: Icons.chat_bubble_outline,
        title: 'Conversation Study',
        subtitle: 'Practice real Korean dialogues',
        color: const Color(0xFF7c3aed),
        onTap: () => context.go('/conversations'),
      ),
      _StudyCardData(
        icon: Icons.auto_stories,
        title: 'Story Study',
        subtitle: 'Read graded Korean stories',
        color: const Color(0xFF059669),
        onTap: () => context.go('/stories'),
      ),
      _StudyCardData(
        icon: Icons.headphones,
        title: 'Listening Practice',
        subtitle: 'Train your Korean ear',
        color: const Color(0xFFe11d48),
        onTap: () {},
      ),
      _StudyCardData(
        icon: Icons.article_outlined,
        title: 'Reading Room',
        subtitle: 'Read news articles with vocab support',
        color: const Color(0xFFca8a04),
        onTap: () => context.go('/news'),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Study Room')),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final twoColumns = constraints.maxWidth >= 760;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: KhColors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: KhColors.border),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Deep study missions',
                        style: TextStyle(
                            fontSize: 19, fontWeight: FontWeight.w700)),
                    SizedBox(height: 6),
                    Text(
                      'After article review, continue here for writing, speaking, and grammar reinforcement.',
                      style: TextStyle(color: KhColors.gray),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (twoColumns)
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: cards
                      .map((c) => SizedBox(
                            width: (constraints.maxWidth - 44) / 2,
                            child: _studyCard(c),
                          ))
                      .toList(),
                )
              else
                ...cards.expand((c) => [_studyCard(c), const SizedBox(height: 12)]),
            ],
          );
        },
      ),
    );
  }

  Widget _studyCard(_StudyCardData card) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: card.onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: KhColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KhColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: card.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(card.icon, color: card.color, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.title,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(card.subtitle,
                      style:
                          const TextStyle(fontSize: 13, color: KhColors.gray)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: KhColors.gray),
          ],
        ),
      ),
    );
  }
}

class _StudyCardData {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _StudyCardData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });
}
