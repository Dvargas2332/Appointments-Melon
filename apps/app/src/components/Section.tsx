import React from "react";
import { View, Text } from "react-native";
import { sharedStyles } from "../styles/theme";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sharedStyles.section}>
      <Text style={sharedStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
