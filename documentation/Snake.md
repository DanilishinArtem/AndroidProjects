# Application creation (Example: Snake game)
## Commot architecture
- React Native = 'display'
- Kotlin = 'brain
```java
React Native (JS)
 ├── Canvas / View (drawing)
 ├── Touch / Buttons
 └── calls →
        ↓
Android Native (Kotlin)
 ├── GameEngine
 │   ├── Snake state
 │   ├── Movement
 │   ├── Collision
 │   └── Tick loop
 └── exposes methods →
        ↑
JS get state → draw
```

## Some info about promises:

```js
SnakeModule.startGame(width, height)
    .then(initialState => setState(initialState))
    .catch(err => console.error(err));
```

`Promise chain`: `do asynchronic aperation`, and when it will be terminated do `.then`, if it will break `.catch` 

Call of NativeModule:
```
JS → Bridge → Kotlin → SnakeEngine → Bridge → JS
```

When we have a function in the Kotlin, we put output of the function `convertMapToWritableMap` to the promise: `promise.resolve(...)`:
```kt
@ReactMethod
fun startGame(width: Int, height: Int, promise: Promise) {
    engine = SnakeEngine(width, height)
    val state = engine?.tick()
    if (state != null) {
        promise.resolve(convertMapToWritableMap(state))
    }
}
```
Then in the JS we can call function startGame through module `SnakeModule` and through `.then` use the output `initialState`: 
```js
    .then(initialState => setState(initialState))
```

## Plan of realization:
- Step 1: minimum bridge between JS and Kotlin (without game, just for checking bridge):
    - Creation Native Module by using Kotlin
    - Calling Kotlin-function out of JS
    - Return datas back
- Step 2: Game engine by using Kotlin
    - Field
    - Snake
    - apple
    - Making tick() - one step of the game
    - Returning state of the field back to JS
- Step 3: Drawing in React Native
    - Drawing field (View/absolute layout)
    - Drawing snake
    - Inserting buttons of controlle

## Step 1: minimum bridge between JS and Kotlin (without game, just for checking bridge)
In the folder `./android/app/src/main/java/com/snake/` we have two files:
- MainApplication.kt
- MainActivity.kt

In the React Native `Module` and `Package` - are different levels of reasponsibilities
- `Module`: **What** you give to JS (functions, states, API)
- `Package`: **How** React Native know, that module exists

`More detailed`:
- `SnameModule` (class SnakeModule(...) : ReactContextBaseJavaModule):
    - Contain business-logic
    - Exporting methods to JS (@ReactMethod)
    - Know nothing about how sombody will be include it
    - If we will not registrate it, it will not be created
- `SnakePackage` (class SnakePackage : ReactPackage)
    - Tells to React Native: Here is list of modules, that you have
    - Create instances: SnakeModule
    - Take a part of bootstrapping React Native

`Architectural analogy` (Without catalog the factory doesn't know the engine exists):
- SnakeModule $\rightarrow$ Engine
- SnakePackage $\rightarrow$ Engine catalog
- MainApplication $\rightarrow$ Factory

`Why not in a single class`:
- Historically and architecturally
- Module - runtime object
- Package - startup configuration

`Graph of workflow`
```
Android App starts
↓
MainApplication.onCreate()
↓
getPackages()
↓
SnakePackage.createNativeModules()
↓
SnakeModule instantiated
↓
JS sees NativeModules.SnakeModule
```

Here is the table that give us understanding of differences between levels. This is already a pure architecture, but not "Expo-magic":
<div align="center">

|Level|What it is|
|---|---|
|Package|Registartion|
|Module|API|
|Engine|Logic|
|JS|UI|
</div>
<div align="center">
Table 1. Differences of levels
</div>

### Step 1: Create Kotlin Native Module
- Create file `SnakeModule.kt`. This is the module which React Native will can call later.
```kt
package com.snake
// ReactApplicationContext: gives us access to: lifecycle, events, UI threads, bridge
// It lives the same time as JS runtime
import com.facebook.react.bridge.ReactApplicationContext
// ReactContextBaseJavaModule: base class for native-modules. Without it RN will not recognize our module 
// 1. It automativally registrate itself in RN 
// 2. Can work with bridge
// 3. Control lifecycle
import com.facebook.react.bridge.ReactContextBaseJavaModule
// For access methods to JS runtime
import com.facebook.react.bridge.ReactMethod

// RN create this object for us
// Pass to it ReactApplicationContext
// We should not create it ourselves
class SnakeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    // This is the name that JS can call
    // The name is the bridge between JS and Kotlin
    override fun getName(): String {
        return "SnakeModule"
    }

    // Annotation:
    // Mark method as accessible from JS
    // Without it the method will not be accessible
    @ReactMethod
    // RN serializate arguments
    // Passing them through bridge
    // Kotlin will get a String
    fun helloFromKotlin(message: String) {
        println("SnakeModule says: $message")
    }
}
```
### Step 2: Registration of the module (Package)
- Create file `SnakePackage.kt`
```kt
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
```

### Step 3. Including package to the `MainApplication.kt`

In the MainApplication.kt we gonna change method `getPackages()` by adding our package `SnakePackage`
- Change stock `getPackages()` method
```kt
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
    }
```
- To this `getPackage()` method
```kt
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(SnakePackage())
    }
```

### Step 4. Calling Kotlin from JS
```js
// useEffect - React hook, which:
  // 1. Execute code after render
  // 2. Used for:
    // 2.1. Side effects
    // 2.2. Subscriptions
    // 2.3. native-calls
import {useEffect} from 'react';
// NativeModules - is a JS representation of the bridge
// NativeModules = {
//   SnakeModule: {
//     helloFromKotlin: function
//   },
//   OtherModule: ...
// }
import {Text, View, NativeModules} from 'react-native';
// 'const { SnakeModule } = NativeModules;' is equivalent to 'const SnakeModule = NativeModules.SnakeModule;'
const {SnakeModule} = NativeModules;

export default function App() {
  // useEffect(() => { ... }, []);
  // [] - means:
    // call one time
    // after render
    // during mounting dependences
  useEffect(
    () => {
      SnakeModule.helloFromKotlin("Hello from Kotlin!");
    },[]);

    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>Snake Game</Text>
      </View>
    )
}
```

### Step 5. Debugging application
- Building our application (one of two ways):
    - `npx expo run:android`
    - `npx expo start` (then we should press `a`)
- Checking our logs:
    - `adb logcat | grep SnakeModule`

## Step 2: Game engine by using Kotlin
### Creation of the engine of the game
Crate file SnakeEngine.kt
Targets:
- Field of the game (width, height)
- Snake (list of coordinates)
- Directions of movements
- Food
- tick() - step of the game
- State, which we can return to JS

Minimal code:
```kt
package com.snake

data class Point(val x: Int, val y: Int)

enum class Direction {
    UP, DOWN, LEFT, RIGHT
}

class SnakeEngine(val width: Int = 10, val height: Int = 10){

    private var snake: MutableList<Point> = mutableListOf(Point(width / 2, height / 2))

    private var direction: Direction = Direction.RIGHT
    private var food: Point = generateFood()

    private fun generateFood(): Point {
        while(true){
            val p = Point((0 until width).random(), (0 until height).random())
            if(!snake.contains(p)){
                return p
            }
        }
    }

    fun changeDirection(newDir: Direction){
        // we can not move to reverse direction
        if((direction == Direction.UP && newDir == Direction.DOWN) ||
        (direction == Direction.DOWN && newDir == Direction.UP) ||
        (direction == Direction.LEFT && newDir == Direction.RIGHT) ||
        (direction == Direction.RIGHT && newDir == Direction.LEFT)) {
            return
        }else{
            direction = newDir
        }
    }

    fun tick(): Map<String, Any> {
        val head = snake.first()
        val newHead = when (direction) {
            Direction.UP -> Point(head.x, head.y - 1)
            Direction.DOWN -> Point(head.x, head.y + 1)
            Direction.LEFT -> Point(head.x - 1, head.y)
            Direction.RIGHT -> Point(head.x + 1, head.y)
        }

        // check if we hit the wall
        if(newHead.x !in 0 until width || newHead.y !in 0 until height){
            return mapOf("gameOver" to true)
        }

        // check if we hit ourself
        if(snake.contains(newHead)){
            return mapOf("gameOver" to true)
        }

        snake.add(0, newHead)

        // check if we ate the food
        if(newHead == food){
            food = generateFood()
        }else{
            snake.removeLast()
        }

        // return state
        // mapOf(key to value, ...)
        // "snake" to snake.map { mapOf("x" to it.x, "y" to it.y) }
        // snake is a MutableList<Point>
        // map - is a standard Kotlin function for list transformations
        // For each Point (each cell of the snake) we create a new map: mapOf("x" to it.x, "y" to it.y)
        // it - is the current element of the list, i.e., Point(x,y): "x" to it.x -> key-value pair and the same for y
        // Example: if the ssnake consists of points (2,3), (2,2), (2,1): snake.map {mapOf("x" to it.x, "y" to it.y)}
        // [
        //   {"x":2, "y":3},
        //   {"x":2, "y":2},
        //   {"x":2, "y":1}
        // ]
        return mapOf(
            "snake" to snake.map {mapOf("x" to it.x, "y" to it.y)},
            "food" to mapOf("x" to food.x, "y" to food.y),
            "gameOver" to false
        )
    }
}
```
### Creation of the Module by using SnakeEngine
Create file SnakeModule.kt
```kt
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
```
## Step 3. Render a snake using React Native
Plan:
- JS get state of the game from Kotlin (snake, food, gameOver)
- Rendering field of snake in the view of grid
- Snake moves each N ms

General scheme:
- Kotlin (Android, SnakeEngine)
    - Read logic of the game (snake, food, hit)
- React Native (App.js)
    - Render of the map
    - Pass commands (up/down/left/right)
    - Regularly asks for the status (tick())

```js
// React: framework
// useState: state container of the component
// useEffect: lifecycle hook 
import React, {useEffect, useState} from 'react';
// TouchableOpacity: button
// StyleSheet: styles
// NativeModules: bridge between JS and Kotlin
import {View, Text, TouchableOpacity, StyleSheet, NativeModules} from 'react-native';

const {SnakeModule} = NativeModules;

export default function App() {
  // state of the game
  // state = {
  //   snake: [{x, y}, {x, y}, ...],
  //   food: {x, y},
  //   gameOver: false
  // }
  // setState: call render of the UI
  const [state, setState] = useState(null);
  const width = 10;
  const height = 10;
  // Running of the game
  useEffect(() => {
    // Initialization of the game
    // Promise has a 3 states: pending (working), fulfilled (success), rejected (error)
    SnakeModule.startGame(width, height)
      .then((initialState) => setState(initialState))
      .catch(err => console.error(err));
    
    const interval = setInterval(() => {
      SnakeModule.tick()
        .then((newState) => {
          setState(newState);
          if (newState.gameOver) {
            alert('Game Over!');
            clearInterval(interval);
          }
        })
        .catch(err => console.error(err));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (!state) return <View style={styles.container}><Text>Loading...</Text></View>;

  // Render of the grid
  const renderGrid = () => {
    const grid = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        // Checking the presence of the snake (remember that in Kotlin we returned a list of objects {x, y})
        const isSnake = state.snake.some(p => p.x === x && p.y === y);
        const isFood = state.food.x === x && state.food.y === y;

        row.push(
          <View 
            key={`${x}-${y}`}
            style={[
              styles.cell,
              isSnake && styles.snake,
              isFood && styles.food
            ]}
          />
        );
      }
      grid.push(
        <View key={y} style={styles.row}>
          {row}
        </View>
      );
    }
    return grid;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Snake Game (2026)</Text>
      
      <View>{renderGrid()}</View>

      {/* Buttons of control in the main View */}
      <View style={styles.controls}>
        <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={() => SnakeModule.changeDirection('up')}>
                <Text>UP</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={() => SnakeModule.changeDirection('left')}>
                <Text>LEFT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => SnakeModule.changeDirection('down')}>
                <Text>DOWN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => SnakeModule.changeDirection('right')}>
                <Text>RIGHT</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 20},
  row: {flexDirection: 'row'},
  cell: {width: 30, height: 30, borderWidth: 0.5, borderColor: '#ddd', backgroundColor: 'white'},
  snake: {backgroundColor: '#4CAF50', borderRadius: 4},
  food: {backgroundColor: '#FF5252', borderRadius: 15},
  controls: {marginTop: 30, alignItems: 'center'},
  button: {
    padding: 20, 
    margin: 5, 
    backgroundColor: '#ddd', 
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center'
  }
});
```









<!-- Рестарт: Добавь кнопку "Restart", которая снова вызывает SnakeModule.startGame -->
<!-- Кнопки: Управлять змейкой кнопками на экране не очень удобно. Позже можно добавить PanResponder для управления свайпами. -->
<!-- react-native-skia -->