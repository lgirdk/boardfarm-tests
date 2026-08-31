┌─────────────────────────────────────────────────────┐
│                   boardfarm-ai                       │
└─────────────────────────────────────────────────────┘
=========================================================================
        ┌───────────────────┐              ┌───────────────────────────┐
        │     CLI           │              │     FastAPI (api/)         │
        │     main.py       │              │  middleware ─ routers      │
        │                   │              │  schemas ── dependencies   │
        └────────┬──────────┘              └────────────┬──────────────┘
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │         orchestrator.py         │
                    │   loads config, wires services  │
                    └──┬──────────────┬──────────────┘
                       │              │
           ┌───────────┘              └────────────────┐
           ▼                                           ▼
┌─────────────────────┐                  ┌─────────────────────┐
│   codegen/          │                  │   search_store/      │
│   driver_agent      │◄────hooks────┐   │   search_engine      │
│   reasoning         │              │   │   registry           │
│   generator         │              │   │   encoders           │
└──────────┬──────────┘              │   └──────────┬──────────┘
           │                         │              
           ▼                         │              
┌─────────────────────┐              │   ┌─────────────────────┐
│   llm/              │              │   │   .models/           │
│   anthropic         │              │   │   bge-base           │
│   openai            │              │   │   bge-small          │
│   custom_gpt4o      │              │   └─────────────────────┘
└──────────┬──────────┘              │
                                     │   ┌─────────────────────┐
                                     │   │   artifacts/         │
┌─────────────────────┐              │   │   stubs_index.json   │
│   **************    │              │   └─────────────────────┘
│   *************     │              │
│   ************      │              │   ┌─────────────────────┐
│   **************    │              └───│   domains/           │
└─────────────────────┘                  │   boardfarm/         │
                                         │   hooks              │
                                         │   prompts            │
                                         │   input_model        │
                                         └─────────────────────┘


======================================

boardfarm_ai/
│
├── main.py                         
├── pyproject.toml                   
├── uv.lock                          
├── Dockerfile                       
├── docker-compose.yaml              
├── .env                             
├── .env.example                     
├── .dockerignore                    
│
├── configs/                         
│   ├── app.toml                     
│   ├── codegen/
│   │   ├── codegen.toml             
│   │   └── search.toml              
│   └── search_store/
│       └── store_config.toml        
│
├── artifacts/                       
│   └── stubs_index.json             
│
├── .models/                        
│   ├── bge-base-en-v1.5/
│   └── bge-small-en-v1.5/
│
├── api/                            
│   ├── __init__.py
│   ├── app.py                      
│   ├── middleware.py               
│   ├── dependencies.py            
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── codegen.py               
│   │   └── log_analyzer.py          
│   └── schemas/
│       ├── __init__.py
│       ├── codegen.py               
│       └── log_analyzer.py         
│
└── src/                             
    ├── __init__.py
    ├── orchestrator.py              
    │
    ├── codegen/                    
    │   ├── __init__.py
    │   ├── driver_agent.py          
    │   ├── data_models.py           
    │   ├── config_schema.py         
    │   ├── reasoning.py             
    │   ├── search.py                
    │   ├── generator.py             
    │   └── prompt/                  
    │       └── ...
    │
    ├── llm/                         
    │   ├── __init__.py
    │   ├── templates.py             
    │   ├── data_containers.py       
    │   ├── config_schema.py        
    │   ├── anthropic.py             
    │   ├── openai_llm.py            
    │   └── custome_openi_gpt4o_client.py  
    │
    ├── search_store/               
    │   ├── __init__.py
    │   ├── config_schema.py         
    │   ├── search_engine.py         
    │   ├── utils.py                 
    │   └── filters.py               
    │
    └── domains/                     
        ├── __init__.py
        └── boardfarm/               
            ├── __init__.py
            ├── hooks.py             
            ├── input_model.py       
            ├── domain_knowledge.md  
            └── prompts/             
                ├── pytest/          
                │   ├── standard/
                │   │   ├── reasoning_system.md
                │   │   ├── reasoning_user.md
                │   │   ├── generation_system.md
                │   │   └── generation_user.md
                │   └── compact/
                │       └── ...
                └── robot/           
                    └── standard/
                        └── ...