import { Slot } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { AuthProvider } from "../context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({});
