import * as http from "http"
import * as vscode from "vscode"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ClinePlanModeResponse } from "../shared/ExtensionMessage"

interface CommandRequest {
	command: string
	args?: any[]
}

interface CommandResponse {
	success: boolean
	result?: any
	error?: string
}

interface AutomationCommand {
	command: string
	description: string
	args?: {
		name: string
		type: string
		description: string
	}[]
}

interface TaskStatus {
	isRunning: boolean
	isWaitingForUser: boolean
	currentStep?: string
	lastUpdateTime: number
	isAwaitingPlanResponse?: boolean
	availableOptions?: string[]
}

interface SendTextRequest {
	text: string
	shouldSubmit?: boolean
}

export class AutomationServer {
	private server: http.Server | null = null
	private port: number = 3000

	private commandMap: { [key: string]: string } = {
		openNewTab: "cline.openInNewTab",
		clickPlusButton: "cline.plusButtonClicked",
		clickMCPButton: "cline.mcpButtonClicked",
		clickSettingsButton: "cline.settingsButtonClicked",
		clickHistoryButton: "cline.historyButtonClicked",
		clickAccountButton: "cline.accountButtonClicked",
		addToChat: "cline.addToChat",
		addTerminalOutput: "cline.addTerminalOutputToChat",
		fixWithCline: "cline.fixWithCline",
		switchToPlanMode: "cline.switchToPlanMode",
		switchToActMode: "cline.switchToActMode",
		clickSelectButton: "cline.clickSelectButton",
		getTaskStatus: "cline.getTaskStatus",
		sendText: "cline.sendText",
		startNewTask: "cline.startNewTask",
	}

	private availableCommands: AutomationCommand[] = [
		{
			command: "openNewTab",
			description: "在新标签页中打开Cline",
		},
		{
			command: "clickPlusButton",
			description: "点击加号按钮",
		},
		{
			command: "clickMCPButton",
			description: "点击MCP按钮",
		},
		{
			command: "clickSettingsButton",
			description: "点击设置按钮",
		},
		{
			command: "clickHistoryButton",
			description: "点击历史按钮",
		},
		{
			command: "clickAccountButton",
			description: "点击账户按钮",
		},
		{
			command: "addToChat",
			description: "将选中的代码添加到聊天",
			args: [
				{
					name: "range",
					type: "object",
					description: "代码范围 {start: {line: number, character: number}, end: {line: number, character: number}}",
				},
			],
		},
		{
			command: "addTerminalOutput",
			description: "将终端输出添加到聊天",
		},
		{
			command: "fixWithCline",
			description: "使用Cline修复代码",
			args: [
				{
					name: "range",
					type: "object",
					description: "代码范围 {start: {line: number, character: number}, end: {line: number, character: number}}",
				},
			],
		},
		{
			command: "switchToPlanMode",
			description: "切换到计划模式",
		},
		{
			command: "switchToActMode",
			description: "切换到执行模式",
		},
		{
			command: "clickSelectButton",
			description: "点击选择按钮",
			args: [
				{
					name: "buttonId",
					type: "string",
					description: "选择按钮的唯一标识符",
				},
			],
		},
		{
			command: "getTaskStatus",
			description: "获取当前任务状态",
		},
		{
			command: "sendText",
			description: "发送文本内容到输入框并提交",
			args: [
				{
					name: "text",
					type: "string",
					description: "要发送的文本内容",
				},
				{
					name: "shouldSubmit",
					type: "boolean",
					description: "是否自动提交（默认为true）",
				},
			],
		},
		{
			command: "startNewTask",
			description: "启动一个新的任务",
			args: [
				{
					name: "task",
					type: "string",
					description: "任务的初始消息",
				},
				{
					name: "images",
					type: "array",
					description: "可选的图片数据URI数组",
				},
			],
		},
	]

	constructor(private context: vscode.ExtensionContext) {}

	public async start(): Promise<void> {
		if (this.server) {
			return
		}

		this.server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
			try {
				await this.handleRequest(req, res)
			} catch (error) {
				console.error("Error handling request:", error)
				res.writeHead(500)
				res.end(JSON.stringify({ error: "Internal Server Error" }))
			}
		})

		return new Promise((resolve, reject) => {
			this.server!.listen(this.port, () => {
				console.log(`Automation server listening on port ${this.port}`)
				resolve()
			}).on("error", (err: Error) => {
				console.error("Failed to start automation server:", err)
				reject(err)
			})
		})
	}

	public stop(): void {
		if (this.server) {
			this.server.close()
			this.server = null
		}
	}

	private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		if (req.method === "GET") {
			if (req.url === "/commands") {
				res.writeHead(200)
				res.end(JSON.stringify(this.availableCommands))
				return
			}
			// if (req.url === '/task-status') {
			//     res.writeHead(200);
			//     res.end(JSON.stringify(this.taskStatus));
			//     return;
			// }
		}

		if (req.method !== "POST") {
			res.writeHead(405)
			res.end(JSON.stringify({ error: "Method Not Allowed" }))
			return
		}

		let body = ""
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString()
		})

		req.on("end", async () => {
			try {
				const request = JSON.parse(body)
				const result = await this.executeCommand(request)
				res.writeHead(200)
				res.end(JSON.stringify(result))
			} catch (error) {
				res.writeHead(400)
				res.end(JSON.stringify({ error: "Invalid Request" }))
			}
		})
	}

	private async executeCommand(request: CommandRequest): Promise<CommandResponse> {
		try {
			console.log(`executeCommand: ${JSON.stringify(request)}`)
			const vscodeCommand = this.commandMap[request.command]
			if (!vscodeCommand) {
				return {
					success: false,
					error: `Unknown command: ${request.command}`,
				}
			}

			const visibleProvider = ClineProvider.getVisibleInstance()
			if (!visibleProvider) {
				return {
					success: false,
					error: "No visible Cline instance found",
				}
			}

			// 特殊处理启动新任务
			if (request.command === "startNewTask") {
				const [task, images] = request.args || []
				await visibleProvider.initClineWithTask(task, images)
				return {
					success: true,
					result: "New task started successfully",
				}
			}

			// 特殊处理范围参数
			let args = request.args || []
			if (request.command === "addToChat" || request.command === "fixWithCline") {
				const range = args[0]
				if (range) {
					args[0] = new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character)
				}
			}

			// 特殊处理模式切换和选择按钮
			if (request.command === "switchToPlanMode" || request.command === "switchToActMode") {
				await visibleProvider.togglePlanActModeWithChatSettings({
					mode: request.command === "switchToPlanMode" ? "plan" : "act",
				})

				return {
					success: true,
					result: "Mode switched successfully",
				}
			}

			if (request.command === "clickSelectButton") {
				const buttonId = args[0]
				if (buttonId) {
					await visibleProvider.postMessageToWebview({
						type: "action",
						action: "chatButtonClicked",
						text: buttonId,
					})
				}

				return {
					success: true,
					result: "Button clicked successfully",
				}
			}

			if (request.command === "getTaskStatus") {
				// 获取当前Cline实例
				const cline = visibleProvider.getCline()
				if (!cline) {
					return {
						success: false,
						error: "No active Cline instance found",
					}
				}

				// 获取最后一条消息
				const lastMessage = cline.clineMessages.at(-1)
				let availableOptions: string[] | undefined

				if (lastMessage?.type === "ask" && lastMessage.ask === "plan_mode_respond") {
					try {
						const messageContent = JSON.parse(lastMessage.text || "{}") as ClinePlanModeResponse
						availableOptions = messageContent.options
					} catch (e) {
						console.error("Failed to parse plan mode response:", e)
					}
				}

				return {
					success: true,
					result: {
						isRunning: cline.isStreaming || cline.isWaitingForFirstChunk || cline.isAwaitingPlanResponse,
						isAwaitingPlanResponse: cline.isAwaitingPlanResponse,
						availableOptions,
					},
				}
			}

			if (request.command === "sendText") {
				const sendTextRequest = args[0] as SendTextRequest
				if (!sendTextRequest || !sendTextRequest.text) {
					return {
						success: false,
						error: "Text content is required",
					}
				}

				// 如果需要提交，发送提交消息
				if (sendTextRequest.shouldSubmit !== false) {
					await visibleProvider.postMessageToWebview({
						type: "invoke",
						invoke: "sendMessage",
						text: sendTextRequest.text,
					})
				} else {
					// 发送文本到输入框
					await visibleProvider.postMessageToWebview({
						type: "addToInput",
						text: sendTextRequest.text,
					})
				}

				return {
					success: true,
					result: "Text sent successfully",
				}
			}

			const result = await vscode.commands.executeCommand(vscodeCommand, ...args)
			return {
				success: true,
				result,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			}
		}
	}
}
