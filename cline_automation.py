#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
from typing import Optional, Dict, Any, List, Union

class ClineAutomation:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url

    def _make_request(self, command: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """发送请求到automation server"""
        url = self.base_url
        payload = {"command": command}
        if args:
            payload["args"] = args

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"请求失败: {e}")
            return {"success": False, "error": str(e)}

    def get_available_commands(self) -> List[Dict[str, Any]]:
        """获取所有可用的命令列表"""
        try:
            response = requests.get(f"{self.base_url}/commands")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"获取命令列表失败: {e}")
            return []

    def open_new_tab(self) -> Dict[str, Any]:
        """在新标签页中打开Cline"""
        return self._make_request("openNewTab")

    def click_plus_button(self) -> Dict[str, Any]:
        """点击加号按钮"""
        return self._make_request("clickPlusButton")

    def click_mcp_button(self) -> Dict[str, Any]:
        """点击MCP按钮"""
        return self._make_request("clickMCPButton")

    def click_settings_button(self) -> Dict[str, Any]:
        """点击设置按钮"""
        return self._make_request("clickSettingsButton")

    def click_history_button(self) -> Dict[str, Any]:
        """点击历史按钮"""
        return self._make_request("clickHistoryButton")

    def click_account_button(self) -> Dict[str, Any]:
        """点击账户按钮"""
        return self._make_request("clickAccountButton")

    def add_to_chat(self, range_start: Dict[str, int], range_end: Dict[str, int]) -> Dict[str, Any]:
        """将选中的代码添加到聊天"""
        args = {
            "range": {
                "start": range_start,
                "end": range_end
            }
        }
        return self._make_request("addToChat", args)

    def add_terminal_output(self) -> Dict[str, Any]:
        """将终端输出添加到聊天"""
        return self._make_request("addTerminalOutput")

    def fix_with_cline(self, range_start: Dict[str, int], range_end: Dict[str, int]) -> Dict[str, Any]:
        """使用Cline修复代码"""
        args = {
            "range": {
                "start": range_start,
                "end": range_end
            }
        }
        return self._make_request("fixWithCline", args)

    def switch_to_plan_mode(self) -> Dict[str, Any]:
        """切换到计划模式"""
        return self._make_request("switchToPlanMode")

    def switch_to_act_mode(self) -> Dict[str, Any]:
        """切换到执行模式"""
        return self._make_request("switchToActMode")

    def click_select_button(self, button_id: str) -> Dict[str, Any]:
        """点击选择按钮"""
        args = {"buttonId": button_id}
        return self._make_request("clickSelectButton", args)

    def get_task_status(self) -> Dict[str, Any]:
        """获取当前任务状态"""
        return self._make_request("getTaskStatus")

    def send_text(self, text: str, is_new_task: bool = False) -> Dict[str, Any]:
        """发送文本内容到输入框并提交"""
        args = {
            "text": text,
            "isNewTask": is_new_task
        }
        return self._make_request("sendText", args)

    def start_new_task(self, task: str, images: Optional[List[str]] = None) -> Dict[str, Any]:
        """启动一个新的任务"""
        args = [task]
        if images:
            args.append(images)
        return self._make_request("startNewTask", args)

def main():
    # 使用示例
    cline = ClineAutomation()
    
    # 获取可用命令列表
    print("可用命令列表:")
    commands = cline.get_available_commands()
    print(json.dumps(commands, indent=2, ensure_ascii=False))

    # 示例：切换到计划模式
    print("\n切换到计划模式:")
    result = cline.switch_to_plan_mode()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 示例：启动新任务
    print("\n启动新任务:")
    result = cline.start_new_task("帮我实现一个简单的计算器")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 示例：获取任务状态
    print("\n获取任务状态:")
    status = cline.get_task_status()
    print(json.dumps(status, indent=2, ensure_ascii=False))
    
    # 示例：发送文本
    print("\n发送文本:")
    result = cline.send_text("请使用Python实现")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    

if __name__ == "__main__":
    main() 