import { ScreenWrapperProps } from '@/types';
import React from 'react';
import { Dimensions, Platform, StatusBar, View } from 'react-native';

const {height} = Dimensions.get('window');

const ScreenWrapper = ({
  style, 
  children, 
  statusBarStyle = 'dark-content',
  backgroundColor = 'white'
}: ScreenWrapperProps) => {

  let paddingTop = Platform.OS === 'ios' ? height * 0.06 : 50;

  return (
    <View 
      style={[{
        paddingTop,
        flex: 1,
        backgroundColor: backgroundColor,
      }, style]}
    >
      <StatusBar 
        barStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        translucent
      />
      {children}
    </View>
  )
}

export default ScreenWrapper