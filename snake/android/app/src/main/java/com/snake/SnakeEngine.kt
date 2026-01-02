package com.snake

data class Point(val x: Int, val y: Int)

enum class Direction {
    UP, DOWN, LEFT, RIGHT
}

class SnakeEngine(val width: Int = 10, val height: Int = 10){

    private var snake: MutableList<Point> = mutableListOf(Point(width / 2, height / 2))

    private var direction: Direction = Direction.RIGHT
    private var food: Point = generateFood()
    private var gameOver: Boolean = false

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
            gameOver = true
            return mapOf("gameOver" to true)
        }

        // check if we hit ourself
        if(snake.contains(newHead)){
            gameOver = true
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
        gameOver = false
        return mapOf(
            "snake" to snake.map {mapOf("x" to it.x, "y" to it.y)},
            "food" to mapOf("x" to food.x, "y" to food.y),
            "gameOver" to false
        )
    }

    fun getSnake() = snake.toList()
    fun getFood() = food
    fun isGameOver() = gameOver
}