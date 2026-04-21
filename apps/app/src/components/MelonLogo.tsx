import React from "react";
import { View, StyleSheet } from "react-native";

export function MelonLogo({ size = 64 }: { size?: number }) {
  const rind = size;
  const flesh = size * 0.8;
  const seed = Math.max(3, size * 0.06);
  return (
    <View style={[styles.shell, { width: rind, height: rind, borderRadius: rind / 2 }]}>
      <View style={[styles.leaf, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.08 }]} />
      <View style={[styles.stem, { width: size * 0.08, height: size * 0.18, borderRadius: size * 0.04 }]} />
      <View style={[styles.flesh, { width: flesh, height: flesh, borderRadius: flesh / 2 }]}>
        <View style={styles.stripeVertical} />
        <View style={styles.stripeHorizontal} />
        <View style={styles.stripeDiagA} />
        <View style={styles.stripeDiagB} />
        <View style={[styles.seed, { width: seed, height: seed, borderRadius: seed / 2, top: "28%", left: "33%" }]} />
        <View style={[styles.seed, { width: seed, height: seed, borderRadius: seed / 2, top: "49%", left: "54%" }]} />
        <View style={[styles.seed, { width: seed, height: seed, borderRadius: seed / 2, top: "58%", left: "30%" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#3f9f57",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  leaf: {
    position: "absolute",
    top: -4,
    right: 4,
    backgroundColor: "#2f8f4e",
    transform: [{ rotate: "35deg" }],
  },
  stem: {
    position: "absolute",
    top: -6,
    left: "50%",
    backgroundColor: "#2d7a42",
  },
  flesh: {
    backgroundColor: "#f5e642",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stripeVertical: {
    position: "absolute",
    width: "12%",
    height: "100%",
    backgroundColor: "rgba(63,159,87,0.18)",
  },
  stripeHorizontal: {
    position: "absolute",
    width: "100%",
    height: "12%",
    backgroundColor: "rgba(63,159,87,0.18)",
  },
  stripeDiagA: {
    position: "absolute",
    width: "140%",
    height: "10%",
    backgroundColor: "rgba(63,159,87,0.12)",
    transform: [{ rotate: "45deg" }],
  },
  stripeDiagB: {
    position: "absolute",
    width: "140%",
    height: "10%",
    backgroundColor: "rgba(63,159,87,0.12)",
    transform: [{ rotate: "-45deg" }],
  },
  seed: {
    position: "absolute",
    backgroundColor: "#1a3d26",
  },
});
