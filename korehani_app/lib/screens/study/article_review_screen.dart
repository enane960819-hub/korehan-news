import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/learning_hub_service.dart';
import '../../theme/kh_theme.dart';

class ArticleReviewScreen extends StatefulWidget {
  final String articleId;
  final String title;
  final String bodyText;

  const ArticleReviewScreen({
    super.key,
    required this.articleId,
    required this.title,
    required this.bodyText,
  });

  @override
  State<ArticleReviewScreen> createState() => _ArticleReviewScreenState();
}

class _ArticleReviewScreenState extends State<ArticleReviewScreen> {
  late final List<_ReviewItem> _items;
  int _currentIndex = 0;
  int _correctCount = 0;
  int _wrongCount = 0;
  String? _selectedOptionId;
  bool _answered = false;

  @override
  void initState() {
    super.initState();
    _items = _buildReviewItems(widget.bodyText);
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Article Review')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.info_outline, size: 40, color: KhColors.gray),
                const SizedBox(height: 10),
                const Text('Not enough content to generate review items.'),
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: () => context.go('/study'),
                  child: const Text('Go to Study Room'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final item = _items[_currentIndex];
    final progress = (_currentIndex + 1) / _items.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Article Review')),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final maxContentWidth = min(720.0, constraints.maxWidth);
          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.title,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 10),
                    LinearProgressIndicator(
                      value: progress,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Question ${_currentIndex + 1} of ${_items.length} · Correct $_correctCount · Wrong $_wrongCount',
                      style: const TextStyle(fontSize: 12, color: KhColors.gray),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: KhColors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: KhColors.border),
                      ),
                      child: Text(item.prompt,
                          style: const TextStyle(
                              fontSize: 18,
                              height: 1.5,
                              fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(height: 14),
                    ...item.options.map(_buildOptionCard),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _selectedOptionId == null || _answered
                            ? null
                            : _submitAndAutoAdvance,
                        child: Text(
                            _answered ? 'Moving to next...' : 'Submit answer'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildOptionCard(_ReviewOption option) {
    final isSelected = _selectedOptionId == option.id;
    Color borderColor = KhColors.border;
    Color? bgColor;

    if (_answered) {
      if (option.id == _items[_currentIndex].correctOptionId) {
        borderColor = Colors.green;
        bgColor = Colors.green.withValues(alpha: 0.08);
      } else if (isSelected) {
        borderColor = Colors.red;
        bgColor = Colors.red.withValues(alpha: 0.08);
      }
    } else if (isSelected) {
      borderColor = KhColors.bright;
      bgColor = KhColors.bright.withValues(alpha: 0.08);
    }

    return GestureDetector(
      onTap: _answered
          ? null
          : () {
              setState(() {
                _selectedOptionId = option.id;
              });
            },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bgColor ?? KhColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Icon(
              isSelected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_off_outlined,
              color: isSelected ? KhColors.bright : KhColors.gray,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(option.text,
                  style: const TextStyle(fontSize: 15, height: 1.4)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitAndAutoAdvance() async {
    final selected = _selectedOptionId;
    if (selected == null || _answered) return;

    final item = _items[_currentIndex];
    final isCorrect = selected == item.correctOptionId;

    setState(() {
      _answered = true;
      if (isCorrect) {
        _correctCount += 1;
      } else {
        _wrongCount += 1;
      }
    });

    await LearningHubService.logQuizResult(
      skillType: 'reading',
      quizType: 'article_review',
      itemId: '${widget.articleId}_${_currentIndex + 1}',
      contentType: 'article',
      contentId: widget.articleId,
      prompt: item.prompt,
      userAnswer: selected,
      correctAnswer: item.correctOptionId,
      isCorrect: isCorrect,
      score: isCorrect ? 1 : 0,
    );

    await Future.delayed(const Duration(milliseconds: 750));

    if (!mounted) return;
    if (_currentIndex == _items.length - 1) {
      _showCompletionSheet();
      return;
    }

    setState(() {
      _currentIndex += 1;
      _selectedOptionId = null;
      _answered = false;
    });
  }

  void _showCompletionSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Review completed 🎉',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text('Score: $_correctCount / ${_items.length}'),
              const SizedBox(height: 16),
              const Text(
                'Go deeper in Study Room with writing, speaking, and grammar missions.',
                style: TextStyle(color: KhColors.gray),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    this.context.go('/study');
                  },
                  icon: const Icon(Icons.school_outlined),
                  label: const Text('Open Study Room Deep Study'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    this.context.go('/news');
                  },
                  child: const Text('Back to News'),
                ),
              )
            ],
          ),
        );
      },
    );
  }

  List<_ReviewItem> _buildReviewItems(String text) {
    final cleaned = text
        .replaceAll(RegExp(r'\s+'), ' ')
        .replaceAll(RegExp(r'[^\w\s가-힣.,!?]'), '')
        .trim();

    final chunks = cleaned
        .split(RegExp(r'[.!?]\s+'))
        .map((e) => e.trim())
        .where((e) => e.length > 18)
        .take(4)
        .toList();

    if (chunks.isEmpty) return [];

    final allWords = cleaned
        .split(' ')
        .map((e) => e.trim())
        .where((e) => e.length >= 2)
        .toSet()
        .toList();

    final items = <_ReviewItem>[];

    for (var i = 0; i < chunks.length; i++) {
      final words = chunks[i]
          .split(' ')
          .map((e) => e.trim())
          .where((e) => e.length >= 2)
          .toList();
      if (words.length < 4) continue;

      final answer = words[1];
      final prompt = chunks[i].replaceFirst(answer, '_____');

      final distractors = allWords
          .where((w) => w != answer)
          .take(6)
          .toList();

      if (distractors.length < 3) continue;

      final options = <_ReviewOption>[
        _ReviewOption(id: 'A', text: answer),
        _ReviewOption(id: 'B', text: distractors[0]),
        _ReviewOption(id: 'C', text: distractors[1]),
        _ReviewOption(id: 'D', text: distractors[2]),
      ]..shuffle();

      final correct = options.firstWhere((o) => o.text == answer).id;
      items.add(_ReviewItem(prompt: prompt, options: options, correctOptionId: correct));
    }

    return items;
  }
}

class _ReviewItem {
  final String prompt;
  final List<_ReviewOption> options;
  final String correctOptionId;

  const _ReviewItem({
    required this.prompt,
    required this.options,
    required this.correctOptionId,
  });
}

class _ReviewOption {
  final String id;
  final String text;

  const _ReviewOption({required this.id, required this.text});
}
