import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/kh_theme.dart';

class KhLogo extends StatelessWidget {
  final double fontSize;
  final Color? color;

  const KhLogo({super.key, this.fontSize = 32, this.color});

  @override
  Widget build(BuildContext context) {
    final textColor = color ?? KhColors.logoBLue;
    return RichText(
      text: TextSpan(
        style: GoogleFonts.happyMonkey(
          fontSize: fontSize,
          color: textColor,
        ),
        children: [
          const TextSpan(text: 'KoreHan'),
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: _LogoI(fontSize: fontSize, textColor: textColor),
          ),
        ],
      ),
    );
  }
}

class _LogoI extends StatelessWidget {
  final double fontSize;
  final Color textColor;

  const _LogoI({required this.fontSize, required this.textColor});

  @override
  Widget build(BuildContext context) {
    final dotSize = fontSize * 0.18;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Text(
          'i',
          style: GoogleFonts.happyMonkey(
            fontSize: fontSize,
            color: textColor,
          ),
        ),
        Positioned(
          top: fontSize * 0.06,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              width: dotSize,
              height: dotSize,
              decoration: const BoxDecoration(
                color: KhColors.logoDot,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
