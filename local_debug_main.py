# if i keep here the message is comming
# from .configs.shared_state import SHARED_STATE
import logging
import os

from rich.logging import RichHandler

from boardfarm_api.api.schemas.codegen import CodegenJiraTestInputSchema, _TestStep
from boardfarm_api.ai_engine.codegen.enums import CodegenOutputType
from boardfarm_api.ai_engine.engine import Engine as Orchestrator

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True)],
)

logging.getLogger("codegen.searcher_agent").setLevel(logging.DEBUG)
breakpoint()

test1 = """TEST STEPS:
Step 1: Verify CM is online on the CMTS and eRouter WAN interface 
        acquires both IPv4 and IPv6 addresses
Step 2: Verify that the LAN client acquires IPv4 and IPv6 addresses
Step 3: Verify LAN client can access the internet (WAN) over IPv4
Step 4: Start IPv4 TCP iPerf traffic from LAN to WAN on port 5001 
        for 30 seconds and verify traffic flows successfully
Step 5: Stop the iPerf traffic and retrieve iPerf logs; verify 
        non-zero throughput
Step 6: From LAN client, perform DNS lookup for a domain name and 
        verify IPv4 address resolution
Step 7: Verify that CPE iptables rules are not empty and check 
        the default firewall policy
Step 8: From LAN client, ping the WAN IPv4 address and verify 
        successful ICMP response"""


"""TEST NAME: test_MVX_TST_6227
DESCRIPTION: DUT must notify ACS of change in value of 2.4GHz Private SSID password when active notification is enabled
PRECONDITIONS: eRouter in dual/ipv4/ipv6 mode, LAN client available, TR-069 ACS available
TEST STEPS:
Step 1: Execute SetParameterAttributes RPC on Device.WiFi.AccessPoint.10001.Security.X_LGI-COM_ShadowPassphrase with NotificationChange=true, Notification=2, AccessChange=false, AccessList=empty
Step 2: Execute GetParameterAttributes RPC on the same parameter and verify notification is set to active (2)
Step 3: Start packet capture on ACS to capture Inform messages from DUT
Step 4: Login to DUT UI page from LAN client and navigate to Wireless Security page
Step 5: On Wireless Security page change SSID password for 2.4GHz and apply settings
Step 6: Verify from the packet capture that Inform message sent from DUT to ACS contains eventcode '4 VALUE CHANGE' with the WiFi parameter name and the new password value
"""
test2 = """
TEST STEPS:
Step 1: Perform GetParameterValues to fetch parameter Device.X_LGI-COM_WoL.
Step 2: Perform SetParameterValues to change the default value of interval and Retries.
Step 3: Perform GetParameterValues to fetch parameter Device.X_LGI-COM_WoL.
Step 4: Start tcpdump on LAN interface.
Step 5: Perform SetParameterValues to set the mac address for sending WoL frames.
Step 6: Verify WoL frames captured on ethernet LAN interface if the target MAC already exist in the scheduler.
Step 7: Login to DUT UI page from LAN client and navigate to Wireless Security page
"""
# 1. Set LLC filter on All interfaces(0) for ARP IPv4 protocols in CM config file.
#    Set LLC filter UnmatchedAction as Discard(1) in CM config file.
# 2. Reboot the DUT to reflect the changes done in CM config file.
# 3. Verify the LLC filters values via SNMP respective MIBs.
# 4. Verify the following interfaces gets IPv4 address - CM, eMTA, LAN.
# 5. Verify that LAN interface is not getting the IPv6 address.
# 6. Verify the Ping IPv4 traffic between WAN to LAN & eMTA.

# test_test = """
# TEST STEPS:
# Step 1: Set LLC filter on All interfaces(0) for ARP IPv4 protocols in CM config file.Set LLC filter UnmatchedAction as Discard(1) in CM config file.
# Step 2: Reboot the DUT to reflect the changes done in CM config file.
# Step 3: Verify the LLC filters values via SNMP respective MIBs.
# Step 4: Verify the following interfaces gets IPv4 address - CM, eMTA, LAN.
# Step 5: Verify that LAN interface is not getting the IPv6 address.
# Step 6: Verify the Ping IPv4 traffic between WAN to LAN & eMTA.
# # """
# test_test = """
# TEST STEPS:
# Step 1: Reboot the DUT and verify Provisioning.
# Step 2: Verify the downstream and upstream bonding status of DUT at CMTS.
# Step 3: Check if the eCM acquires the IP address.
# Step 4: Verify that DUT downloads and parses the config file without any issues.
# Step 5: Do SNMP Walk 'docsIfUpChannelId' MIB object on DUT and verify DUT returns all US channel identities.
# Step 6: Do SNMP Walk 'docsIfDownChannelId' MIB object on DUT and verify DUT returns all DS channel identities.
# Step 7: Verify that eMTA acquires IPv4 address.
# Step 8: Verify that eMTA downloads the configuration file.
# Step 9: Verify that eMTA applies the configuration correctly.
# Step 10: Verify that eMTA provisioning is completed successfully.
# Step 11: eRouter acquires correct IP address.""

test_test = """
TEST STEPS:
Step 1: Modify NmAccess community string for public as 'manualpublic' via SNMP Set with 'private' community name.
Step 2: Modify NmAccess community string for private as 'manualprivate' via SNMP Set with 'private' community name.
Step 3: Verify that NmAccess default community string is changed to user defined manualpublic community name via SNMPGet.
Step 4: Verify that NmAccess default community string is changed to user defined manualprivate community name via SNMPGet.
Step 5: Verify NmAccess read operation via SNMPGet on public community name.
Step 6: Verify NmAccess read operation via SNMPGet on private community name.
Step 7: Verify NmAccess read operation via SNMPGet with wrong community name 'abcdef'.
"""

from sentence_transformers import CrossEncoder

# breakpoint()
# model =  CrossEncoder(
#             "BAAI/bge-reranker-base",
#             local_files_only=False
#         )
# breakpoint()
# model.predict(("query", "document")batch_size=32))


def get_models_from_HF():
    from huggingface_hub import snapshot_download

    # NOTE
    # scp -r ./minilm user@workmachine:/home/ahazra/models/minilm
    # Note this downloads he entire repo models safetensor and bins as well
    # we can use sentensetranformer to actually download what sentensetrnformer wants
    # and then we ca can coppy the snapshow fromthe .cache
    snapshot_download(
        repo_id="sentence-transformers/all-MiniLM-L6-v2", local_dir="./minilm"
    )


def main():
    import json

    from rich import print

    # breakpoint()
    step_list = []
    for test in test_test.strip().split("\n"):
        if test == "TEST STEPS:":
            continue
        num, step = test.removeprefix("Step").split(":")
        step_list.append(
            _TestStep(
                step_num=int(num.strip()),
                instruction=step.strip(),
            )
        )

    test_obj = CodegenJiraTestInputSchema(
        name="test_demo_532", steps=step_list, description=None, preconditions=None
    )
    import os

    # ssh cvntpj0b9cuebc-64410aaa@ssh.runpod.io -i ~/.ssh/id_ed25519
    LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://100.78.76.21:4000")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")
    # LLM_BASE_URL = "https://o9x3wo66b8jwug-8000.proxy.runpod.net/v1/"
    # LLM_MODEL = "qwen3.6:27b"
    LLM_API_KEY = ""
    # llm =  CustomeOpenAIGPT4oClient(
    #     model=LLM_MODEL,
    #     base_url=LLM_BASE_URL,
    #     api_key=LLM_API_KEY
    # )
    # llm =  AnthropicClient(
    #     model="claude-sonnet-4-5",
    #     api_key="",
    # )
    breakpoint()
    orc = Orchestrator("/home/ahazra/workspace/claude_test/configs/app.toml")
    orc.codegen_app.generate(
        test_obj, output_task_type=CodegenOutputType.PYTEST
    )
    breakpoint()

    # agent  =  DriverAgent(
    #     llm=llm,
    #     search_engine= code_search_engine

    # )
    # agent.generate(test_obj)
    breakpoint()
    breakpoint()

    # manager.build_embeddings_from_stub_idx(search_corpus=search_corpus)

    # manager.search(value)
    breakpoint()


if __name__ == "__main__":
    main()
#
