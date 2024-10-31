import os, sys, json
from game import AI_ball, WIDTH, HEIGHT, NB_GENERATION, NB_SPECIES, SAVE_FILE
from ai import Init_Ai, Save_Best_Ai

# def create_frame(frame_data):
#     return {
#         "ball": {
#             "x": frame_data["ball"]["x"],
#             "y": frame_data["ball"]["y"],
#             "dx": frame_data["ball"]["dx"],
#             "dy": frame_data["ball"]["dy"]
#         },
#         "leftPaddle": frame_data["leftPaddle"],
#         "playerDecision": frame_data["playerDecision"]
#     }

class Paddle:
    def __init__(self, y):
        self.y = y

class Frame:
    ball : AI_ball
    leftPaddle : Paddle
    playerDecision : int

    def __init__(self, ball, leftPaddle, playerDecision):
        self.ball = ball
        self.leftPaddle = Paddle(leftPaddle)
        self.playerDecision = playerDecision

def create_frame(frame_data):
    return Frame(AI_ball(frame_data["ball"]["x"], frame_data["ball"]["y"], frame_data["ball"]["dx"], frame_data["ball"]["dy"]), frame_data["leftPaddle"], frame_data["playerDecision"])

def train_Ai_human(frames):
    Ai_Sample = []
    for j in range(NB_GENERATION):
        print(f"\n\n========== Generation #{j}===========\n")
        Ai_Sample = Init_Ai("yes")

        for i in range(NB_SPECIES):
            Ai_Sample[i].ai_score = 0
            for frame in frames:
                # Mirror ball position for the Ai right's position
                frame.ball.x = WIDTH - frame.ball.x
                frame.ball.dx *= -1

                if (Ai_Sample[i].decision(frame.leftPaddle, frame.ball, HEIGHT) == frame.playerDecision):
                    Ai_Sample[i].ai_score += 1
            print(f"The AI opponent {i} score is {Ai_Sample[i].ai_score}")
        Save_Best_Ai(Ai_Sample, SAVE_FILE + "_vsHuman")

def main():
    # Retrieve arguments from sys.argv
    nb_args = len(sys.argv[1:])
    if (nb_args == 0):
        print("Usage: give the path to a json's file")
        return

    frames = []
    
    # Read the file
    with open(sys.argv[1], 'r') as file:
        json_string = file.read()

        try:
            # First, try to parse the JSON
            parsed_data = json.loads(json_string)
            # print("After first parse:", type(parsed_data))
            
            # If it's still a string, parse again
            if isinstance(parsed_data, str):
                parsed_data = json.loads(parsed_data)
                # print("After second parse:", type(parsed_data))
            
            # Get first element if it's nested
            if isinstance(parsed_data, list) and len(parsed_data) > 0:
                match_stats = parsed_data[0]
                # print("Final match_stats type:", type(match_stats))
                # print("Sample frame:", match_stats[0] if match_stats else "Empty")

            frames = [create_frame(frame) for frame in match_stats]

            train_Ai_human(frames)

        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            return
        # except Exception as e:
        #     print(f"Other error: {e}")
        #     return

    print("Training against human done")

if __name__ == "__main__":
    main()
