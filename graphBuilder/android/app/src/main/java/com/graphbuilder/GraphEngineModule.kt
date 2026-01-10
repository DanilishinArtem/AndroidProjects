package com.graphbuilder

import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors
import android.util.Log

class GraphEngineModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private val executorService = Executors.newSingleThreadExecutor()

    override fun getName(): String = "GraphEngine"


    @ReactMethod
    fun runGraph(
        graphJson: String,
        startNodeId: String,
        promise: Promise
    ) {
        executorService.execute {
            try {
                // 1. Parse graph
                val graph = parseGraph(graphJson)

                if (!graph.containsKey(startNodeId)) {
                    throw IllegalArgumentException("Start node '$startNodeId' not found")
                }

                // 2. Execute graph
                val executor = GraphExecutor(graph)
                executor.start(startNodeId)

                // 3. Resolve promise
                promise.resolve("Graph executed successfully")
            } catch (e: Exception) {
                promise.reject("GRAPH_EXECUTION_ERROR", e)
            }
        }
    }

    private fun parseNodeType(raw: String): NodeType {
        return try {
            NodeType.valueOf(raw.trim().replace(" ", "_").uppercase())
        } catch (e: Exception) {
            throw IllegalArgumentException("Unknown node type: $raw")
        }
    }

    private fun parseGraph(json: String): Map<String, Node> {
        Log.d("GraphEngineModule", "Parsing graph JSON: $json")
        val root = JSONObject(json)

        val nodesArray = root.getJSONArray("nodes")
        val linksArray = root.getJSONArray("links")

        // fromNodeId -> list of toNodeId
        val outputsByNode = mutableMapOf<String, MutableList<String>>()

        // Parse links
        for (i in 0 until linksArray.length()) {
            val link = linksArray.getJSONObject(i)
            val from = link.getString("from")
            val to = link.getString("to")

            outputsByNode
                .getOrPut(from) { mutableListOf() }
                .add(to)
        }

        // Parse nodes
        val graph = mutableMapOf<String, Node>()

        for (i in 0 until nodesArray.length()) {
            val nodeJson = nodesArray.getJSONObject(i)

            val id = nodeJson.getString("id")
            val typeStr = nodeJson.getString("type")

            val type = parseNodeType(typeStr)

            val outputs = outputsByNode[id] ?: emptyList()
            Log.d("GraphEngineModule", "Parsed node: id=$id, type=$type, outputs=$outputs")
            graph[id] = Node(
                id = id,
                type = type,
                outputs = outputs
            )
        }

        return graph
    }
}