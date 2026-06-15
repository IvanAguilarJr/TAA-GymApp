import React, { useCallback, useEffect, useRef } from "react";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal>;
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  scrollable?: boolean;
  children: React.ReactNode;
};

export default function AppBottomSheet({
  sheetRef,
  snapPoints = ["60%", "90%"],
  onDismiss,
  scrollable = false,
  children,
}: Props) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  const Content = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{
        backgroundColor: "#222222",
        width: 40,
        height: 4,
      }}
      backgroundStyle={{
        backgroundColor: "#111111",
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
      }}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <Content contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        {children}
      </Content>
    </BottomSheetModal>
  );
}
