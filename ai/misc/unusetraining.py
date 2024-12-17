# # Old unuse training mode

# class Frame:
#     ball : AI_ball
#     leftPaddle : float
#     playerDecision : int

#     def __init__(self, ball, leftPaddle, playerDecision):
#         self.ball = ball
#         self.leftPaddle_y = leftPaddle
#         self.playerDecision = playerDecision

# def ai_bonus_score(ball_y, rightPaddle, Ai_selected):
#     dist = abs(ball_y - rightPaddle.top) / gameconfig.HEIGHT

#     if dist < 0.05:
#         Ai_selected.ai_score = (1 - dist) / 10 + Ai_selected.ai_score 

# def train_predefined(Ai_selected, Ai_nb):
#     # Initialize game objects
#     rightPaddle = Paddle(
#         x = gameconfig.WIDTH - 50 - gameconfig.PADDLE_WIDTH,
#         y = gameconfig.HEIGHT//2 - gameconfig.PADDLE_HEIGHT//2,
#         width = gameconfig.PADDLE_WIDTH,
#         height = gameconfig.PADDLE_HEIGHT
#     )

#     # Predifine game loop
#     total_predefined = 0
#     for predefined_y in range(round(gameconfig.HEIGHT / 10), gameconfig.HEIGHT, round(gameconfig.HEIGHT / 10)):
#         ball = Ball(
#             x = 50,
#             y = predefined_y,
#             size = gameconfig.BALL_SIZE
#         )

#         for predefined_angle in range(-75, 76):
#             total_predefined += 1
#             # Ball movement
#             ball_dx = gameconfig.BALL_SPEED
#             ball_dy = gameconfig.BALL_SPEED * -math.sin(predefined_angle)

#             # Update AI's target position
#             ai_ball = AI_ball(ball, 0, 0, 0)
#             ai_ball.update(ball, ball_dx, ball_dy)

#             i = 0
#             while (True):
#                 # Move the ball
#                 ball.x += ball_dx
#                 ball.y += ball_dy

#                 # Update the ai view
#                 if i % 60 == 0:
#                     ai_ball.update(ball, ball_dx, ball_dy)

#                 # Move the right paddle
#                 match (Ai_selected.decision(rightPaddle.y, ai_ball, gameconfig.HEIGHT)):
#                     case 0:
#                         if rightPaddle.top > 0:
#                             rightPaddle.y -= gameconfig.PADDLE_SPEED
#                     case 1:
#                         pass
#                     case 2:
#                         if rightPaddle.bottom < gameconfig.HEIGHT:
#                             rightPaddle.y += gameconfig.PADDLE_SPEED

#                 # Ball collision with top and bottom
#                 if ball.top <= 0:
#                     ball.top = gameconfig.GRID
#                     ball_dy *= -1
#                     if abs(ball_dy) < 1:
#                         ball_dy = 1 if ball_dy > 0 else -1
#                 elif ball.bottom >= gameconfig.HEIGHT:
#                     ball.bottom = gameconfig.HEIGHT - gameconfig.GRID
#                     ball_dy *= -1
#                     if abs(ball_dy) < 1:
#                         ball_dy = 1 if ball_dy > 0 else -1

#                 # Ball collision with AI's paddles
#                 if collides(ball, rightPaddle):
#                     if ball.right < rightPaddle.right:
#                         Ai_selected.ai_score += 1
#                         break

#                 # Ball out of bounds
#                 if ball.right >= gameconfig.WIDTH:
#                     ai_bonus_score(ball.y, rightPaddle, Ai_selected)
#                     break
                
#                 i += 1

#     print(f"\nScore before normal game: {Ai_selected.ai_score:.1f} / {total_predefined}")

# def create_frame(frame_data):
#     return Frame(AI_ball(frame_data["ball"]["x"],
#                         frame_data["ball"]["y"],
#                         frame_data["ball"]["dx"],
#                         frame_data["ball"]["dy"]),
#                 frame_data["leftPaddle"], frame_data["playerDecision"])

# def get_human_inputs():
#     # Read the file
#     try:
#         with open("./data.json", 'r') as file:
#             json_string = file.read()

#             try:
#                 # First, try to parse the JSON
#                 parsed_data = json.loads(json_string)
                
#                 # If it's still a string, parse again
#                 if isinstance(parsed_data, str):
#                     parsed_data = json.loads(parsed_data)
                
#                 # Get first element if it's nested
#                 if isinstance(parsed_data, list) and len(parsed_data) > 0:
#                     match_stats = parsed_data[0]

#                 frames = [create_frame(frame) for frame in match_stats]

#                 return frames

#             except json.JSONDecodeError as e:
#                 print(f"JSON parsing error: {e}")
#                 return
#     except Exception as e:
#         return None


# # Train against human's inputs
# def train_human(Ai_selected, Ai_nb):
#     frames = get_human_inputs()

#     if frames == None:
#         return

#     ai_ball = AI_ball(frames[0].ball, 0, 0, 0)
#     tick = 0
#     for frame in frames:
#         # Update the ball's position every second
#         if tick % 60 == 0:
#             # Mirror ball position for the Ai right's position
#             frame.ball.x = gameconfig.WIDTH - frame.ball.x
#             ai_ball.update(frame.ball, frame.ball.dx * -1, frame.ball.dy)

#         # Compare the AI's decision with the player's decision
#         if (Ai_selected.decision(frame.leftPaddle_y, ai_ball, gameconfig.HEIGHT) == frame.playerDecision):
#             Ai_selected.ai_score += 0.5
        
#         tick += 1
