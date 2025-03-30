import * as http from "http"
import * as vscode from "vscode"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ClinePlanModeResponse } from "../shared/ExtensionMessage"

interface CommandRequest {
	command: string
	args?: { [key: string]: any }
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
	isNewTask?: boolean
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
					name: "isNewTask",
					type: "boolean",
					description: "是否启动一个新的任务（默认为false）",
				},
			],
		},
	]

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
		let ret_obj: CommandResponse = {
			success: true,
			result: "Command executed successfully",
		}
		try {
			console.log(`executeCommand: ${JSON.stringify(request)}`)
			const vscodeCommand = this.commandMap[request.command]
			if (!vscodeCommand) {
				ret_obj.success = false
				ret_obj.error = `Unknown command: ${request.command}`
				return ret_obj
			}

			const visibleProvider = ClineProvider.getVisibleInstance()
			if (!visibleProvider) {
				ret_obj.success = false
				ret_obj.error = "No visible Cline instance found"
				return ret_obj
			}

			switch (request.command) {
				case "switchToPlanMode":
				case "switchToActMode":
					await visibleProvider.togglePlanActModeWithChatSettings({
						mode: request.command === "switchToPlanMode" ? "plan" : "act",
					})
					ret_obj.result = "Mode switched successfully"
					break
				case "clickSelectButton":
					const buttonId = request.args?.buttonId
					if (buttonId) {
						await visibleProvider.postMessageToWebview({
							type: "action",
							action: "chatButtonClicked",
							text: buttonId,
						})
					}
					ret_obj.result = "Button clicked successfully"
					break

				case "getTaskStatus":
					const cline = visibleProvider.getCline()
					if (!cline) {
						ret_obj.success = false
						ret_obj.error = "No active Cline instance found"
						break
					}

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

					ret_obj.result = {
						isRunning: cline.isStreaming || cline.isWaitingForFirstChunk || cline.isAwaitingPlanResponse,
						isAwaitingPlanResponse: cline.isAwaitingPlanResponse,
						availableOptions,
					}
					break

				case "sendText":
					const sendTextRequest = request.args as SendTextRequest
					if (!sendTextRequest || !sendTextRequest.text) {
						ret_obj.success = false
						ret_obj.error = "Text content is required"
						break
					}

					if (sendTextRequest.isNewTask !== false) {
						await visibleProvider.initClineWithTask(sendTextRequest.text, [])
					} else {
						await visibleProvider.postMessageToWebview({
							type: "invoke",
							invoke: "sendMessage",
							text: sendTextRequest.text,
						})
					}

					ret_obj.result = "Text sent successfully"
					break

				default:
					const result = await vscode.commands.executeCommand(vscodeCommand)
					ret_obj.result = result
					break
			}
		} catch (error) {
			ret_obj.success = false
			ret_obj.error = error instanceof Error ? error.message : "Unknown error occurred"
		}

		return ret_obj
	}
}
