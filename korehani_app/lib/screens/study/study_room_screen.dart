import 'package:flutter/material.dart';
import '../../theme/kh_theme.dart';

class StudyRoomScreen extends StatelessWidget {
  const StudyRoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Study Room')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _studyCard(
            icon: Icons.edit_note,
            title: 'Daily Writing',
            subtitle: 'Practice writing on today\'s topic',
            color: KhColors.bright,
          ),
          const SizedBox(height: 12),
          _studyCard(
            icon: Icons.chat_bubble_outline,
            title: 'Conversation Study',
            subtitle: 'Practice real Korean dialogues',
            color: const Color(0xFF7c3aed),
          ),
          const SizedBox(height: 12),
          _studyCard(
            icon: Icons.auto_stories,
            title: 'Story Study',
            subtitle: 'Read graded Korean stories',
            color: const Color(0xFF059669),
          ),
          const SizedBox(height: 12),
          _studyCard(
            icon: Icons.headphones,
            title: 'Listening Practice',
            subtitle: 'Train your Korean ear',
            color: const Color(0xFFe11d48),
          ),
          const SizedBox(height: 12),
          _studyCard(
            icon: Icons.article_outlined,
            title: 'Reading Room',
            subtitle: 'Read news articles with vocab support',
            color: const Color(0xFFca8a04),
          ),
        ],
      ),
    );
  }

  Widget _studyCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    return Container(
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
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style:
                        const TextStyle(fontSize: 13, color: KhColors.gray)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: KhColors.gray),
        ],
      ),
    );
  }
}
