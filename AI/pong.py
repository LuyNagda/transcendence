import pygame, random, time, os, pickle, sys
import numpy as np
from NNAI import AI_decision, Neuron_Network
from utils import opponent_ball, reset_ball, WIDTH, HEIGHT, DISPLAY_GAME, DYSPLAY_LOG, AI_DELAY, MAX_SCORE, NB_GENERATION, NB_SPECIES, MAX_FRAME_RATE, SAVE_AI,SAVE_FILE, WHITE, BLACK, RED, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_WIDTH, BALL_SIZE, BALL_SPEED_X,BALL_SPEED_Y

Ai_Sample = []

def pong_game(Ai_Sample, SHOW_MATCH):
    # Initialize Pygame
    pygame.init()

    if SHOW_MATCH == "yes":
        window = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pong")

    # Create paddles and ball
    player = pygame.Rect(50, 0, PADDLE_WIDTH, HEIGHT)
    opponent = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED_X * random.choice((1, -1))
    ball_dy = BALL_SPEED_Y * random.choice((1, -1))

    # Score
    player_score = 0
    opponent_score = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Move the player's paddle
        if keys[pygame.K_w] and player.top > 0:
            player.y -= PADDLE_SPEED
        if keys[pygame.K_s] and player.bottom < HEIGHT:
            player.y += PADDLE_SPEED

        # Update opponent's target position every second
        ai_ball = opponent_ball()

        if (AI_DELAY == "yes"):
            current_time = time.time()
            if current_time - last_update_time >= 1:
                ai_ball.x = ball.x
                ai_ball.y = ball.y
                ai_ball.dx = ball_dx
                ai_ball.dy = ball_dy
                last_update_time = current_time
        
        else:
            ai_ball.x = ball.x
            ai_ball.y = ball.y
            ai_ball.dx = ball_dx
            ai_ball.dy = ball_dy

        # Move the opponent's paddle (simple AI)
        match (AI_decision(Ai_Sample, opponent, ai_ball, HEIGHT)):
            case 0:
                if opponent.top > 0:
                    opponent.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if opponent.bottom < HEIGHT:
                    opponent.y += PADDLE_SPEED

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Ball collision with top and bottom
        if ball.top <= 0 or ball.bottom >= HEIGHT:
            ball_dy *= -1

        # Ball collision with paddles
        if ball_dx < 0 and player.right >= ball.left and player.top <= ball.centery <= player.bottom:
            if ball.left > player.left:
                ball.left = player.right
                ball_dx *= -1
        elif ball_dx > 0 and opponent.left <= ball.right and opponent.top <= ball.centery <= opponent.bottom:
            if ball.right < opponent.right:
                ball.right = opponent.left
                ball_dx *= -1
                Ai_Sample.ai_score += 1

        # Ball out of bounds
        if ball.left <= 0:
            opponent_score += 1
            ball_dx, ball_dy = reset_ball(ball)
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball(ball)

        # End the game
        if player_score >= MAX_SCORE:
            running = False

        if SHOW_MATCH == "yes":
            # Clear the screen
            window.fill(BLACK)

            # Draw paddles and ball
            pygame.draw.rect(window, WHITE, player)
            pygame.draw.rect(window, WHITE, opponent)
            pygame.draw.ellipse(window, WHITE, ball)

            # Draw scores
            player_text = font.render(str(player_score), True, WHITE)
            opponent_text = font.render(str(opponent_score), True, WHITE)
            window.blit(player_text, (WIDTH//4, 20))
            window.blit(opponent_text, (3*WIDTH//4, 20))

            # Draw the center line
            pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

            # Update the display
            pygame.display.flip()

            # Cap the frame rate
            if (MAX_FRAME_RATE != 0):
                clock.tick(MAX_FRAME_RATE)

    # Quit the game
    pygame.quit()

def Init_Ai(base):
    Ai_Sample.clear()

    if (os.path.exists(SAVE_FILE) and base != "yes"):
        with open(SAVE_FILE, 'rb') as imp:
            for i in range(5):
                Saved_Ai = pickle.load(imp)
                Ai_Sample.append(Saved_Ai)
                Ai_Sample.append(Saved_Ai)
        Mix_Weights(Ai_Sample)
        for i in range(NB_SPECIES - 30):
            random_ai = Neuron_Network()
            Ai_Sample.append(random_ai)
    else:
        for i in range(NB_SPECIES):
            random_ai = Neuron_Network()
            Ai_Sample.append(random_ai)
    
    for i in range(NB_SPECIES):
        Ai_Sample[i].ai_score = 0
    
def Mix_Weights(Ai_Sample):
    for j in range(5):
        for i in range(4):
            mutated_ai = Ai_Sample[j]
            mutated_ai.layer1.weights[np.random.randint(0, 3)] = np.random.randn()
            Ai_Sample.append(mutated_ai)
   

def Save_Best_Ai(Ai_Sample, save_file):
    Ai_Sample.sort(reverse=True)

    if (len(save_file) > 0):
        SAVE_FILE = "./Saved_AI/" + save_file

    with open(SAVE_FILE, 'wb') as save:  # Overwrites any existing file.
        for i in range(5):
            pickle.dump(Ai_Sample[i], save, pickle.HIGHEST_PROTOCOL)

    Ai_Sample.clear()

def train_Ai(save_file, base):
    for j in range(NB_GENERATION):
        print(f"\n\n========== Generation #{j}===========\n")
        Init_Ai(base)

        for i in range(NB_SPECIES):
            Ai_Sample[i].ai_score = 0
            if pong_game(Ai_Sample[i], DISPLAY_GAME) == "STOP":
                break
            if (DYSPLAY_LOG == "yes"):
                print(f"The AI opponent {i} send back the ball {Ai_Sample[i].ai_score} times")
        Save_Best_Ai(Ai_Sample, save_file)

    if (DYSPLAY_LOG != "yes"):
        for j in range(NB_SPECIES):
            print(f"The AI opponent {j} send back the ball {Ai_Sample[j].ai_score} times")

    if (SAVE_AI == "no"):
        os.remove(SAVE_FILE)

def play_Ai(Ai, demo):
    # Initialize Pygame
    pygame.init()

    window = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Pong")

    # Colors
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)

    # Paddle settings
    PADDLE_WIDTH = 15
    PADDLE_HEIGHT = 90
    PADDLE_SPEED = 5

    # Ball settings
    BALL_SIZE = 15
    BALL_SPEED_X = 7
    BALL_SPEED_Y = 7

    # Create paddles and ball
    if (demo == "yes"):
        player = pygame.Rect(50, 0, PADDLE_WIDTH, HEIGHT)
    else:
        player = pygame.Rect(50, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    opponent = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED_X * random.choice((1, -1))
    ball_dy = BALL_SPEED_Y * random.choice((1, -1))

    # Score
    player_score = 0
    opponent_score = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Move the player's paddle
        if keys[pygame.K_w] and player.top > 0:
            player.y -= PADDLE_SPEED
        if keys[pygame.K_s] and player.bottom < HEIGHT:
            player.y += PADDLE_SPEED

        # Update opponent's target position every second
        ai_ball = opponent_ball()

        if (AI_DELAY == "yes"):
            current_time = time.time()
            if current_time - last_update_time >= 1:
                ai_ball.x = ball.x
                ai_ball.y = ball.y
                ai_ball.dx = ball_dx
                ai_ball.dy = ball_dy
                last_update_time = current_time
        
        else:
            ai_ball.x = ball.x
            ai_ball.y = ball.y
            ai_ball.dx = ball_dx
            ai_ball.dy = ball_dy

        # Move the opponent's paddle (simple AI)
        match (AI_decision(Ai, opponent, ai_ball, HEIGHT)):
            case 0:
                if opponent.top > 0:
                    opponent.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if opponent.bottom < HEIGHT:
                    opponent.y += PADDLE_SPEED

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Ball collision with top and bottom
        if ball.top <= 0 or ball.bottom >= HEIGHT:
            ball_dy *= -1

        # Ball collision with paddles
        if ball_dx < 0 and player.right >= ball.left and player.top <= ball.centery <= player.bottom:
            if ball.left > player.left:
                ball.left = player.right
                ball_dx *= -1
        elif ball_dx > 0 and opponent.left <= ball.right and opponent.top <= ball.centery <= opponent.bottom:
            if ball.right < opponent.right:
                ball.right = opponent.left
                ball_dx *= -1

        # Ball out of bounds
        if ball.left <= 0:
            opponent_score += 1
            ball_dx, ball_dy = reset_ball(ball)
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball(ball)

        # End the game
        if player_score >= MAX_SCORE:
            running = False

        # Clear the screen
        window.fill(BLACK)

        # Draw paddles and ball
        pygame.draw.rect(window, WHITE, player)
        pygame.draw.rect(window, WHITE, opponent)
        pygame.draw.ellipse(window, WHITE, ball)

        # Draw scores
        player_text = font.render(str(player_score), True, WHITE)
        opponent_text = font.render(str(opponent_score), True, WHITE)
        window.blit(player_text, (WIDTH//4, 20))
        window.blit(opponent_text, (3*WIDTH//4, 20))

        # Draw the center line
        pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

        # Update the display
        pygame.display.flip()

        if (MAX_FRAME_RATE != 0):
            clock.tick(MAX_FRAME_RATE)

    # Quit the game
    pygame.quit()

def load_Ai(save_file):
    with open(save_file, 'rb') as imp:
        Ai = pickle.load(imp)
        return (Ai)

# Run the game
def main():
    print("\n\tThanks for tying my AI =)")

    # Retrieve arguments from sys.argv
    nb_args = len(sys.argv[1:])
    if (nb_args == 0):
        print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save")
        return

    match sys.argv[1]:
        case "train":
            save_file = ""
            base = "no"

            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
            
            if (len(sys.argv) > 3):
                base = sys.argv[3]
            
            train_Ai(save_file, base)
        
        case "play":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                else:
                    return print("Save file doesn't exist!")

            else:
                if (os.path.exists(SAVE_FILE)):
                    Ai = load_Ai(SAVE_FILE)
                else:
                    return print("Save file doesn't exist!")

            play_Ai(Ai, "no")

        case "demo":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                else:
                    return print("Save file doesn't exist!")
            else:
                if (os.path.exists(SAVE_FILE)):
                    Ai = load_Ai(SAVE_FILE)
                else:
                    return print("Save file doesn't exist!")
            play_Ai(Ai, "yes")

        case _:
            print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save")
            return
        
if __name__ == "__main__":
    main()