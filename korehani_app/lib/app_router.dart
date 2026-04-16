import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'services/supabase_service.dart';
import 'widgets/kh_shell.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/news/news_list_screen.dart';
import 'screens/news/article_detail_screen.dart';
import 'screens/conversations/conversations_screen.dart';
import 'screens/stories/stories_screen.dart';
import 'screens/study/study_room_screen.dart';
import 'screens/learn/learn_screen.dart';
import 'screens/growth_lab/growth_lab_screen.dart';
import 'screens/mypage/mypage_screen.dart';
import 'screens/fun/fun_screen.dart';
import 'screens/shop/shop_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  redirect: (context, state) {
    final loggedIn = SupabaseService.isLoggedIn;
    final isLoginRoute = state.matchedLocation == '/login';

    if (!loggedIn && !isLoginRoute) return '/login';
    if (loggedIn && isLoginRoute) return '/';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) => KhShell(child: child),
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/news',
          builder: (context, state) => const NewsListScreen(),
        ),
        GoRoute(
          path: '/article/:id',
          builder: (context, state) => ArticleDetailScreen(
            articleId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/conversations',
          builder: (context, state) => const ConversationsScreen(),
        ),
        GoRoute(
          path: '/stories',
          builder: (context, state) => const StoriesScreen(),
        ),
        GoRoute(
          path: '/study',
          builder: (context, state) => const StudyRoomScreen(),
        ),
        GoRoute(
          path: '/learn',
          builder: (context, state) => const LearnScreen(),
        ),
        GoRoute(
          path: '/growth-lab',
          builder: (context, state) => const GrowthLabScreen(),
        ),
        GoRoute(
          path: '/mypage',
          builder: (context, state) => const MyPageScreen(),
        ),
        GoRoute(
          path: '/fun',
          builder: (context, state) => const FunScreen(),
        ),
        GoRoute(
          path: '/shop',
          builder: (context, state) => const ShopScreen(),
        ),
      ],
    ),
  ],
);
