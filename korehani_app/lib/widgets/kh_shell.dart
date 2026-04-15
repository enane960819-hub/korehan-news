import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/kh_theme.dart';

class KhShell extends StatelessWidget {
  final Widget child;

  const KhShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location == '/') return 0;
    if (location.startsWith('/news') || location.startsWith('/article')) {
      return 1;
    }
    if (location.startsWith('/study')) return 2;
    if (location.startsWith('/growth-lab')) return 3;
    if (location.startsWith('/mypage')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: KhColors.border, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: index,
          onTap: (i) {
            switch (i) {
              case 0:
                context.go('/');
              case 1:
                context.go('/news');
              case 2:
                context.go('/study');
              case 3:
                context.go('/growth-lab');
              case 4:
                context.go('/mypage');
            }
          },
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.article_rounded), label: 'News'),
            BottomNavigationBarItem(icon: Icon(Icons.menu_book_rounded), label: 'Study'),
            BottomNavigationBarItem(icon: Icon(Icons.insights_rounded), label: 'Growth'),
            BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'My'),
          ],
        ),
      ),
    );
  }
}
