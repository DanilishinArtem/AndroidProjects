package com.snake
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
// promise - is an object that allows Kotlin to send a result back to JavaScript
// without it, JS wouldn't know the value from native
// JS also has promise:
// const p = new Promise((resolve, reject) => {
//   setTimeout(() => resolve(42), 1000)
// })
// resolve -> the promise was fulfilled successfully, returning the value
// reject -> the promise completed with an error
import com.facebook.react.bridge.Promise

class SnakeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    // var: mutable variable, val: immutable variable
    // Example: var a: Int = null (ERROR), var a: Int? = null (CORRECT)
    // SnakeEngine? -> variable may be null
    // Kotlin doesn't allow null to be easily assigned to regular types
    // When using a nullable variable, remember:
        // use ?.(safe call): engine?.tick()
        // Or we can check for null before using: if(engine != null)
    private var engine: SnakeEngine? = null

    override fun getName(): String {
        return "SnakeModule"
    }

    @ReactMethod
    fun startGame(width: Int, height: Int, promise: Promise) {
        engine = SnakeEngine(width, height)
        val state = engine?.tick()
        if (state != null) {
            promise.resolve(convertMapToWritableMap(state))
        }
    }

    @ReactMethod
    fun tick(promise: Promise) {
        val state = engine?.tick()
        if (state != null) {
            promise.resolve(convertMapToWritableMap(state))
        } else {
            promise.reject("NO_ENGINE", "Game has not started yet.")
        }
    }

    @ReactMethod
    fun changeDirection(dir: String) {
        engine?.changeDirection(
            when (dir.lowercase()) {
                "up" -> Direction.UP
                "down" -> Direction.DOWN
                "left" -> Direction.LEFT
                "right" -> Direction.RIGHT
                else -> return
            }
        )
    }

    // Additional function for converting Map to WritableMap (that can be used by JS)
    private fun convertMapToWritableMap(map: Map<String, Any>): WritableMap {
        val writableMap = Arguments.createMap()
        
        for ((key, value) in map) {
            when (value) {
                is Boolean -> writableMap.putBoolean(key, value)
                is Int -> writableMap.putInt(key, value)
                is String -> writableMap.putString(key, value)
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    writableMap.putMap(key, convertMapToWritableMap(value as Map<String, Any>))
                }
                is List<*> -> {
                    val array = Arguments.createArray()
                    for (item in value) {
                        if (item is Map<*, *>) {
                            @Suppress("UNCHECKED_CAST")
                            array.pushMap(convertMapToWritableMap(item as Map<String, Any>))
                        }
                    }
                    writableMap.putArray(key, array)
                }
            }
        }
        return writableMap
    }
}