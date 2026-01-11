package com.graphbuilder

import android.util.Log
import java.util.Deque
import java.util.Queue
import java.util.ArrayDeque

enum class NodeType {
    CODE,
    FILTER,
    MERGE,
    FLASH_LIGHT,
    VIBRATION,
    WEBHOOK,
    SCHEDULE,
    ON_APP_EVENT,
    AI_AGENT,
    OPENAI,
    DOCUMENT_LOADER
}

data class Message(
    val payload: Map<String, Any?> = emptyMap()
)

data class Node(
    val id: String,
    val type: NodeType,
    val outputs: List<String> = emptyList()
)

interface ExecutableNode {
    fun execute(input: Message): Message
}

// Node implementations would go here, e.g., CodeNode, TriggerNode, etc.
class CodeNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "CodeNode executed with input: $input")
        return Message(mapOf("From" to "CodeNode"))
    }
}

class FilterNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "FilterNode executed with input: $input")
        return Message(mapOf("From" to "FilterNode"))
    }
}

class MergeNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "MergeNode executed with input: $input")
        return Message(mapOf("From" to "MergeNode"))
    }
}

class FlashLightNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "FlashLightNode executed with input: $input")
        return Message(mapOf("From" to "FlashLightNode"))
    }
}

class VibrationNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "VibrationNode executed with input: $input")
        return Message(mapOf("From" to "VibrationNode"))
    }
}

class WebhookNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "WebhookNode executed with input: $input")
        return Message(mapOf("From" to "WebhookNode"))
    }
}

class ScheduleNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "ScheduleNode executed with input: $input")
        return Message(mapOf("From" to "ScheduleNode"))
    }
}

class OnAppEventNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "OnAppEventNode executed with input: $input")
        return Message(mapOf("From" to "OnAppEventNode"))
    }
}

class AiAgentNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "AiAgentNode executed with input: $input")
        return Message(mapOf("From" to "AiAgentNode"))
    }
}

class OpenAINode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "OpenAINode executed with input: $input")
        return Message(mapOf("From" to "OpenAINode"))
    }
}

class DocumentLoaderNode: ExecutableNode {
    override fun execute(input: Message): Message {
        Log.d("GraphEngine", "DocumentLoaderNode executed with input: $input")
        return Message(mapOf("From" to "DocumentLoaderNode"))
    }
}

// Node Factory ------------->
object NodeFactory {
    fun create(type: NodeType): ExecutableNode =
        when (type) {
            NodeType.CODE -> CodeNode()
            NodeType.FILTER -> FilterNode()
            NodeType.MERGE -> MergeNode()
            NodeType.FLASH_LIGHT -> FlashLightNode()
            NodeType.VIBRATION -> VibrationNode()
            NodeType.WEBHOOK -> WebhookNode()
            NodeType.SCHEDULE -> ScheduleNode()
            NodeType.ON_APP_EVENT -> OnAppEventNode()
            NodeType.AI_AGENT -> AiAgentNode()
            NodeType.OPENAI -> OpenAINode()
            NodeType.DOCUMENT_LOADER -> DocumentLoaderNode()
        }
}


// Graph Engine ------------->
class GraphExecutor(
    private val nodes: Map<String, Node>
) {
    private val executors: Map<String, ExecutableNode> = nodes.mapValues { NodeFactory.create(it.value.type) }

    fun start() {
        // incomingMessages: nodeId -> list of (fromNodeId, Message)
        val incomingMessages = mutableMapOf<String, MutableList<Pair<String, Message>>>()

        // incomingNodes: nodeId -> list of source nodeIds
        val incomingNodes = mutableMapOf<String, MutableList<String>>()
        nodes.values.forEach { node ->
            node.outputs.forEach { outId ->
                incomingNodes.getOrPut(outId) { mutableListOf() }.add(node.id)
            }
        }

        // readyQueue: nodes ready to process
        val readyQueue = ArrayDeque<String>()
        // queued: nodes that are being processed or in the queue
        val queued = mutableSetOf<String>()

        // source nodes (no incoming) -> enqueue
        nodes.keys.forEach { nodeId ->
            if (incomingNodes[nodeId].isNullOrEmpty()) {
                readyQueue.add(nodeId)
                queued.add(nodeId)
            }
        }

        val processed = mutableSetOf<String>()

        while (readyQueue.isNotEmpty()) {
            val nodeId = readyQueue.removeFirst()
            queued.remove(nodeId)

            if (processed.contains(nodeId)) continue

            val node = nodes[nodeId] ?: continue
            val executor = executors[nodeId] ?: continue

            val incoming = incomingNodes[nodeId] ?: emptyList()
            val messages = incomingMessages[nodeId] ?: emptyList()

            // Wait for messages from all incoming nodes
            if (messages.size < incoming.size) {
                // if some messages are missing, delay processing to the end of the queue
                readyQueue.addLast(nodeId)
                queued.add(nodeId)
                continue
            }

            // Merge messages: message contrains pairs of (fromNodeId, Message)
            // List<Pair<fromNodeId, Message>>
            val mergedMessage = mergeMessagesWithSources(messages)

            val output = executor.execute(mergedMessage)
            processed.add(nodeId)

            // Pass output to all outputs — marking the source (this nodeId)
            node.outputs.forEach { nextId ->
                val list = incomingMessages.getOrPut(nextId) { mutableListOf() }
                // save pair: from=this nodeId, message=output
                list.add(nodeId to output)

                val nextIncoming = incomingNodes[nextId] ?: emptyList()
                if (list.size >= nextIncoming.size && !processed.contains(nextId) && !queued.contains(nextId)) {
                    readyQueue.add(nextId)
                    queued.add(nextId)
                }
            }
        }
    }

    private fun mergeMessagesWithSources(pairs: List<Pair<String, Message>>): Message {
        val inputsMap = mutableMapOf<String, Map<String, Any?>>()
        val flat = mutableMapOf<String, Any?>()

        for ((fromId, msg) in pairs) {
            inputsMap[fromId] = msg.payload

            // merge flat: if key doesn't exist, put; if not list, convert to list; if list, add
            for ((k, v) in msg.payload) {
                if (!flat.containsKey(k)) {
                    flat[k] = v
                } else {
                    val existing = flat[k]
                    when (existing) {
                        is MutableList<*> -> {
                            // already a list - add new value
                            @Suppress("UNCHECKED_CAST")
                            (existing as MutableList<Any?>).add(v)
                        }
                        else -> {
                            // transform to list of two elements
                            val newList = mutableListOf(existing, v)
                            flat[k] = newList
                        }
                    }
                }
            }
        }

        // Add inputs map under "inputs" key in the flat map, but can change the name
        val finalPayload = mutableMapOf<String, Any?>()
        finalPayload.putAll(flat)
        // finalPayload["inputs"] = inputsMap
        return Message(finalPayload)
    }
}