import 'package:flutter/material.dart';

enum JournalStyle {
  home('welcome', 0xfffbd7d5, 0xff4e3046),
  note('write', 0xfff9e1e7, 0xff49303d),
  collection('letter', 0xfff9e1e7, 0xff49303d),
  agenda('planner', 0xffe1efe6, 0xff293e37),
  account('privacy', 0xffeee5f6, 0xff3d3349),
  profile('welcome', 0xffeee5f6, 0xff3d3349);

  const JournalStyle(this.pose, this.light, this.dark);
  final String pose;
  final int light, dark;

  static JournalStyle forKind(String kind) => switch (kind) {
    'Agenda' => agenda,
    'Akun' => account,
    _ => note,
  };

  Color color(BuildContext context) =>
      Color(Theme.of(context).brightness == Brightness.dark ? dark : light);

  Widget sticker(double size) => Image.asset(
    'assets/mimi/v1/$pose.webp',
    width: size,
    height: size,
    excludeFromSemantics: true,
  );
}

class JournalHeading extends StatelessWidget {
  const JournalHeading(this.title, this.style, {super.key});
  final String title;
  final JournalStyle style;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: style.color(context),
      borderRadius: BorderRadius.circular(24),
    ),
    child: Row(
      children: [
        style.sticker(56),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(
              fontFamily: 'serif',
              fontSize: MediaQuery.sizeOf(context).width <= 600 ? 18 : null,
            ),
          ),
        ),
      ],
    ),
  );
}

class JournalPaper extends StatelessWidget {
  const JournalPaper({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _GridPainter(Theme.of(context).colorScheme.outline.withAlpha(28)),
    child: child,
  );
}

class _GridPainter extends CustomPainter {
  const _GridPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final pen = Paint()..color = color;
    for (double x = 0; x < size.width; x += 23) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), pen);
    }
    for (double y = 0; y < size.height; y += 23) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), pen);
    }
  }

  @override
  bool shouldRepaint(_GridPainter oldDelegate) => color != oldDelegate.color;
}
