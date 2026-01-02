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
  // Key for restarting the game
  const [gameId, setGameId] = useState(0);
  const initialSpeed = 500;
  const [speed, setSpeed] = useState(initialSpeed);
  const width = 10;
  const height = 10;
  // Running of the game
  useEffect(() => {
    let interval;

    // function for starting the game
    const initGame = async () => {
      try {
        const initialState = await SnakeModule.startGame(width, height);
        setState(initialState);
        setSpeed(initialSpeed);

        interval = setInterval(async () => {
          const newState = await SnakeModule.tick();
          if(newState){
            setState(newState);

            if (newState.snake) {
              const snakeLength = newState.snake.length;
              const newSpeed = Math.max(100, INITIAL_SPEED - (snakeLength - 1) * 20);
              setSpeed(newSpeed);
            }
          }

          if(newState.gameOver){
            clearInterval(interval); // stop the game
          }
        }, speed);
      } catch (err){
        console.error(err);
      }
    };

    initGame();

    return () => clearInterval(interval);
  }, [gameId]); // Effect will be executed every time the gameId changes

  const handleRestart = () => {
    setState(null); // Restart current display (will show us Loading...)
    setGameId(prev => prev + 1); // Will change ID, for trigger useEffect
  }

  if (!state) return <View style={styles.container}><Text>Loading...</Text></View>;

  // Render of the grid
  const renderGrid = () => {
    // if we have no datas, wi draw nothing
    if (!state || !state.snake) return null;

    const grid = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        // Теперь это безопасно
        const isSnake = state.snake.some(p => p.x === x && p.y === y);
        const isFood = state.food && state.food.x === x && state.food.y === y;

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
      {state.gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER!</Text>
          <TouchableOpacity style={styles.button} onPress={handleRestart}>
            <Text style={styles.buttonText}>Restart</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.scoreText}>
        Score: {state?.snake?.length - 1} | Speed: {Math.round(1000 / speed)} tps
      </Text>
      <View>{renderGrid()}</View>

      {/* Controls buttons */}
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
  )
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
  },
  overlay: {
    position: 'absolute',
    top: '20%',
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
  },
  gameOverText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 15,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden', // чтобы borderRadius работал с фоном
  },
  restartButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  secondaryRestart: {
    marginTop: 20,
    padding: 10,
  }
});