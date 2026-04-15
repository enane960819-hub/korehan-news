import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'supabase_service.dart';

class AuthService {
  static final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  static Future<AuthResponse?> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return null;

    final googleAuth = await googleUser.authentication;
    final idToken = googleAuth.idToken;
    final accessToken = googleAuth.accessToken;

    if (idToken == null) throw Exception('No ID token');

    final response = await SupabaseService.client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: accessToken,
    );

    return response;
  }

  static Future<void> signOut() async {
    await _googleSignIn.signOut();
    await SupabaseService.client.auth.signOut();
  }

  static Stream<AuthState> get authStateChanges =>
      SupabaseService.client.auth.onAuthStateChange;
}
