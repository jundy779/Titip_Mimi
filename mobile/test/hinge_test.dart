import 'dart:ui' show DisplayFeature, DisplayFeatureState, DisplayFeatureType;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:titip_mimi/main.dart';

void main() {
  testWidgets('engsel tegak terdeteksi, lipatan mulus diabaikan', (tester) async {
    Rect? found;
    Future<void> pump(List<DisplayFeature> features) => tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(
              size: const Size(1114, 720),
              displayFeatures: features,
            ),
            child: Builder(builder: (context) {
              found = verticalHinge(context);
              return const SizedBox();
            }),
          ),
        );

    const duo = Rect.fromLTWH(540, 0, 34, 720);
    await pump(const [
      DisplayFeature(
        bounds: duo,
        type: DisplayFeatureType.hinge,
        state: DisplayFeatureState.postureFlat,
      ),
    ]);
    expect(found, duo);

    await pump(const [
      DisplayFeature(
        bounds: Rect.fromLTWH(442, 0, 0, 720),
        type: DisplayFeatureType.fold,
        state: DisplayFeatureState.postureFlat,
      ),
    ]);
    expect(found, isNull);

    await pump(const []);
    expect(found, isNull);
  });
}
