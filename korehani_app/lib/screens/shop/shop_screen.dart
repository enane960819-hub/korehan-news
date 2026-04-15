import 'package:flutter/material.dart';
import '../../theme/kh_theme.dart';

class ShopScreen extends StatelessWidget {
  const ShopScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shop')),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.store, size: 64, color: KhColors.gray),
            SizedBox(height: 16),
            Text('Shop coming soon',
                style: TextStyle(fontSize: 18, color: KhColors.gray)),
          ],
        ),
      ),
    );
  }
}
