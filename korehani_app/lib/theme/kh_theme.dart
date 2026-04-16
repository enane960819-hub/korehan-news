import 'package:flutter/material.dart';

class KhColors {
  static const Color navy = Color(0xFF0b1626);
  static const Color blue = Color(0xFF1a3a6b);
  static const Color bright = Color(0xFF2255a4);
  static const Color sky = Color(0xFF7ab8f5);
  static const Color dark = Color(0xFF0d1b2e);
  static const Color text = Color(0xFF0d1b2e);
  static const Color gray = Color(0xFF445566);
  static const Color border = Color(0xFFd4dce8);
  static const Color bg = Color(0xFFf0f2f7);
  static const Color white = Color(0xFFffffff);
  static const Color light = Color(0xFFe8eef7);
  static const Color korea = Color(0xFFcc2200);
  static const Color logoBLue = Color(0xFF5B86E5);
  static const Color logoDot = Color(0xFFE8635A);
}

class KhTheme {
  static ThemeData get light {
    const fontFamily = 'sans-serif';

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: KhColors.bg,
      colorScheme: ColorScheme.light(
        primary: KhColors.blue,
        secondary: KhColors.bright,
        surface: KhColors.white,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: KhColors.text,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: KhColors.white,
        foregroundColor: KhColors.text,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      cardTheme: CardThemeData(
        color: KhColors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: KhColors.border),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KhColors.bright,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: KhColors.white,
        selectedItemColor: KhColors.bright,
        unselectedItemColor: KhColors.gray,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dividerColor: KhColors.border,
    );
  }
}
