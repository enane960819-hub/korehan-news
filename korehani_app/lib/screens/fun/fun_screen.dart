import 'package:flutter/material.dart';
import '../../theme/kh_theme.dart';

class FunScreen extends StatelessWidget {
  const FunScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Playground')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _gameCard('😄', 'OX Quiz', 'Test your Korea knowledge', const Color(0xFF2563eb)),
          _gameCard('🎯', 'Chosung Quiz', 'Guess the word from initials', const Color(0xFF7c3aed)),
          _gameCard('🧠', 'Memory Match', 'Match Korean-English pairs', const Color(0xFF059669)),
          _gameCard('🏆', 'Word Cup', 'Pick your favorite Korean word', const Color(0xFFe11d48)),
          _gameCard('🔮', 'Fortune', 'Today\'s Korean fortune', const Color(0xFF7c3aed)),
          _gameCard('🇰🇷', 'Korean Name', 'Generate your Korean name', const Color(0xFF0d9488)),
          _gameCard('🧱', 'Hangul Tetris', 'Build words from blocks', const Color(0xFFca8a04)),
          _gameCard('💧', 'Word Drop', 'Catch falling Korean words', const Color(0xFF2563eb)),
        ],
      ),
    );
  }

  Widget _gameCard(String emoji, String title, String sub, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: KhColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: KhColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(child: Text(emoji, style: const TextStyle(fontSize: 24))),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                Text(sub, style: const TextStyle(fontSize: 12, color: KhColors.gray)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: KhColors.gray),
        ],
      ),
    );
  }
}
