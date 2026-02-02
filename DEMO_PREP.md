# WeaveHacks 3 Submission & Demo Guide

## 1. Immediate Action Items (Pre-recording)
- [ ] **Public Repo**: Ensure your GitHub repo is public.
- [ ] **Weave Check**: Verify traces are appearing in your W&B dashboard.
- [ ] **Clean Slate**: Clear your local database/stash (if needed) so the demo looks fresh.
- [ ] **Sponsor Tools**: You are using **W&B Weave**, **W&B Inference**, **OpenAI/Llama** (via W&B). Make sure to list these.

## 2. The "Winner" Demo Script (2 Minutes Max)

**The Narrative Arc**: "From a basic question to an unexpected discovery."

### 0:00 - 0:20: The Seed (Everyday Question)
*   **Action**: Start on the empty landing page.
*   **Input**: *"Why do we yawn?"*
*   **Narrative**: "We start with something basic. You might think the answer is 'to get more oxygen,' but Fractal helps us dig deeper."
*   **Visual**: Hit enter, watch the tree branch out.

### 0:20 - 0:50: The Exploration (Unexpected Path)
*   **Action**: Notice the AI generated branches. Look for/Click on:
    *   *"Does yawning cool the brain?"* (Thermoregulation theory)
    *   *"Why is yawning contagious?"*
*   **Action**: Click the **3D View Toggle**.
*   **Visual**: Spin the graph. It looks cool.
*   **Action**: Open **Settings**. Tweak "Gravity" slightly to pull nodes together.
*   **Narrative**: "Fractal maps the curiosity space. Here we see a connection between primitive biology and social psychology."

### 0:50 - 1:20: The Collection (Stashing Concepts)
*   **Action**: Click the node *"Does yawning cool the brain?"* -> Click **Generate Children** (optional) or just read the explanation popup.
*   **Action**: **Stash** the concept "Brain Thermoregulation".
*   **Action**: **Stash** the concept "Social Empathy" (from the contagious branch).
*   **Action**: Open **Stash** (Left Sidebar). Drag both items into **Probe** (Right Sidebar).
*   **Narrative**: "I'm collecting two very different ideas: biological brain cooling and social empathy."

### 1:20 - 1:45: The Synthesis (The Answer)
*   **Action**: In Probe, type: *"So what is the unified theory of yawning?"*
*   **Action**: Click **Synthesize**.
*   **Visual**: The AI weaves the Stashed items into a new answer.
*   **Result (Expect)**: "Yawning is likely a primitive mechanism to cool the brain for alertness, which evolved into a social signal to synchronize group vigilance. If I yawn, you yawn, we both stay sharp."
*   **Narrative**: "We moved from 'oxygen myth' to a unified theory of evolutionary biology."

### 1:45 - 2:00: The Technical Flex (Self-Improving Agent)
*   **Action**: Switch tab to **W&B Weave Dashboard**.
*   **Action**: Show the "Score" on a trace.
*   **Narrative**: "Best of all, Fractal optimizes itself. We use an LLM Judge to score the curiosity of every branch, updating our prompt strategies in real-time."

## 3. Alternative "Everyday" Seeds
If you prefer another angle:
1.  **"Why aren't there green mammals?"** (Leads to: Sloths/Algae, Structural Color, Biological Constraints)
2.  **"Why does time feel faster as we age?"** (Leads to: Logarithmic Perception, Novelty Processing, Memory)
3.  **"Where does dust come from?"** (Leads to: Dead skin vs Cosmic dust vs Meteorites)

## 4. Evaluation Criteria Checklist
- [x] **Creativity**: Inverting search ("questions over answers").
- [x] **Self-improving**: The `inference.ts` prompt bandit logic backed by Weave scores.
- [x] **Utility**: Knowledge discovery (finding the "Cooling Brain" theory).
- [x] **Technical Execution**: 3D Graph + Probe Synthesis.
- [x] **Sponsor Usage**: W&B Weave Tracing + Inference.

## 5. Submission Text Template
**Name**: Fractal
**Team**: [Your Names]
**Summary**: Fractal is an infinite curiosity engine that fundamentally inverts the search paradigm: instead of finding answers, it helps you discover better questions. It powers an intellectual journey from "Seed" (your initial thought) to "Synthesis" (new understanding), using a suite of AI agents to extract concepts, generate divergent lines of inquiry, and weave collected insights into profound new ideas.
**Sponsor Tools**:
- **W&B Weave**: The backbone of our self-improving architecture. We implemented an online learning "bandit" algorithm that tests multiple prompt strategies for question generation. Using Weave traces, an LLM Judge scores the quality (curiosity/depth) of every output, and the system automatically updates its weights to favor higher-performing prompts over time without human intervention.
- **W&B Inference**: Used exclusively for our agentic logic, powering the Llama 3.1 models that handle Concept Extraction, Question Generation, and Synthesis.
**How it's built**:
- **Frontend**: A React application featuring a normalized state engine for managing complex knowledge trees. It includes a custom "Stash" and "Probe" system for collecting and synthesizing text fragments.
- **Backend**: A Node/Express server handling the agentic workflow.
- **Agentic Logic**: The "Self-Improving Loop" is the core innovation. It treats prompt engineering as an optimization problem, allowing the agent to "learn" which questioning strategies yield the most insightful results.
