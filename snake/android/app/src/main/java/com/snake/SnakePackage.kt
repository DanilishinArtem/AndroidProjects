package com.snake

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// This is contract with React Native (SnakeModule - is what we can do, ViewManager - is what we declare to RN)
// RN expect from each package:
    // 1. List of NativeModules
    // 2. List of ViewManagers
class SnakePackage : ReactPackage {
    // The method that RN calls once when the JS runtime starts. It returns list of NativeModules
    // RN does not know classes and works through interface NativeModule
    // We return list because: One package = lot of modules. Package is a logical group of modules.
    override fun createNativeModules(reactContext: ReactApplicationContext) : List<NativeModule> {
        return listOf(SnakeModule(reactContext))
    }

    // This is a different type of integration. Native View is not equal Native Module.
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}